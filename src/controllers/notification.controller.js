"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Notification = require("../models/Notification");
const Learner = require("../models/Learner");
const { recordAudit } = require("../services/auditLog.service");

function scheduledVisibilityFilter() {
  const now = new Date();

  return {
    $or: [
      { deliveryMode: { $ne: "scheduled" } },
      { scheduledAt: null },
      { scheduledAt: { $lte: now } }
    ]
  };
}

async function visibleToStudentFilter(studentId) {
  if (!studentId) {
    return { _id: null };
  }

  const now = new Date();
  const sevenDays = new Date();
  sevenDays.setDate(sevenDays.getDate() + 7);

  const learner = await Learner.findById(studentId)
    .select("status accountStatus membership totalFee paidFee")
    .lean();

  if (!learner) {
    return { _id: null };
  }

  const eligibleGroups = [];

  if (
    learner.status === "active" ||
    learner.accountStatus === "active" ||
    learner.membership?.status === "active"
  ) {
    eligibleGroups.push("active");
  }

  const endDate = learner.membership?.endDate
    ? new Date(learner.membership.endDate)
    : null;

  if (
    endDate &&
    endDate >= now &&
    endDate <= sevenDays
  ) {
    eligibleGroups.push("expiring");
  }

  const pendingFee =
    Number(learner.totalFee || 0) -
    Number(learner.paidFee || 0);

  if (pendingFee > 0) {
    eligibleGroups.push("fee_overdue");
  }

  return {
    $and: [
      scheduledVisibilityFilter(),
      {
        $or: [
          {
            recipientType: "all"
          },
          {
            recipientType: "student",
            recipientIds: studentId
          },
          ...(eligibleGroups.length
            ? [
                {
                  recipientType: "group",
                  group: { $in: eligibleGroups }
                }
              ]
            : [])
        ]
      }
    ]
  };
}

function withReadState(notification, user) {
  const json =
    notification.toJSON
      ? notification.toJSON()
      : { ...notification };

  if (user?.role === "student") {
    json.isRead = (notification.readBy || []).some(
      row =>
        String(row.student) ===
        String(user.id)
    );
  }

  if (user?.role === "owner") {
    json.isRead = (notification.readByOwner || []).some(
      row =>
        String(row.owner) ===
        String(user.id)
    );
  }

  return json;
}

const list = asyncHandler(async (req, res) => {
  let filter = {};

  if (req.user.role === "student") {
    // SECURITY: never trust ?studentId from student clients.
    filter = await visibleToStudentFilter(
      req.user.id
    );
  } else {
    filter = scheduledVisibilityFilter();
  }

  const notifications =
    await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(500);

  const data =
    notifications.map(notification =>
      withReadState(
        notification,
        req.user
      )
    );

  sendSuccess(res, {
    data
  });
});

const sent = asyncHandler(async (req, res) => {
  const notifications =
    await Notification.find()
      .sort({ createdAt: -1 })
      .limit(500);

  sendSuccess(res, {
    data: notifications
  });
});

const create = asyncHandler(async (req, res) => {
  const {
    recipientType,
    recipientIds,
    group,
    type,
    priority,
    title,
    message,
    deliveryMode,
    scheduledAt
  } = req.body;

  if (
    recipientType === "student" &&
    (!Array.isArray(recipientIds) ||
      recipientIds.length === 0)
  ) {
    throw ApiError.badRequest(
      "At least one student must be selected."
    );
  }

  if (
    recipientType === "student" &&
    Array.isArray(recipientIds) &&
    recipientIds.length > 0
  ) {
    const uniqueIds = [...new Set(recipientIds.map(String))];

    const validCount = await Learner.countDocuments({
      _id: { $in: uniqueIds }
    });

    if (validCount !== uniqueIds.length) {
      throw ApiError.badRequest(
        "One or more selected students do not exist."
      );
    }
  }

  if (
    recipientType === "group" &&
    !group
  ) {
    throw ApiError.badRequest(
      "Student group is required."
    );
  }

  if (deliveryMode === "scheduled") {
    if (!scheduledAt) {
      throw ApiError.badRequest(
        "scheduledAt is required for scheduled notifications."
      );
    }

    const scheduledDate = new Date(scheduledAt);

    if (
      Number.isNaN(scheduledDate.getTime()) ||
      scheduledDate <= new Date()
    ) {
      throw ApiError.badRequest(
        "scheduledAt must be a valid future date/time."
      );
    }
  }

  const notification =
    await Notification.create({
      recipientType,
      recipientIds:
        Array.isArray(recipientIds)
          ? recipientIds
          : [],
      group:
        group || null,
      type:
        type || "general",
      priority:
        priority || "normal",
      title,
      message,
      deliveryMode:
        deliveryMode || "now",
      scheduledAt:
        deliveryMode === "scheduled"
          ? scheduledAt
          : null,
      createdBy:
        req.user.id
    });

  await recordAudit({
    req,
    action: "notification.send",
    targetType: "notification",
    targetId: notification.id,
    metadata: {
      recipientType,
      recipientCount:
        Array.isArray(recipientIds)
          ? recipientIds.length
          : 0
    }
  });

  sendSuccess(res, {
    statusCode: 201,
    message:
      "Notification sent successfully.",
    data: notification
  });
});

const markRead = asyncHandler(async (req, res) => {
  const notificationId =
    req.params.id ||
    req.body?.notificationId;

  if (!notificationId) {
    throw ApiError.badRequest(
      "Notification ID is required."
    );
  }

  const notification =
    await Notification.findById(
      notificationId
    );

  if (!notification) {
    throw ApiError.notFound(
      "Notification not found."
    );
  }

  /*
   * OWNER
   * Owner ka read state student ke readBy
   * se completely separate rahega.
   */
  if (req.user.role === "owner") {

    const alreadyRead =
      (notification.readByOwner || []).some(
        row =>
          String(row.owner) ===
          String(req.user.id)
      );

    if (!alreadyRead) {
      notification.readByOwner =
        notification.readByOwner || [];

      notification.readByOwner.push({
        owner: req.user.id,
        readAt: new Date()
      });

      await notification.save();
    }

    return sendSuccess(res, {
      message:
        "Notification marked as read.",
      data: {
        id: notification.id,
        isRead: true
      }
    });
  }

  /*
   * STUDENT
   * Student apni notification hi read kar
   * sakta hai.
   */
  if (req.user.role === "student") {

    const studentId =
      req.user.id;

    const visibleFilter =
      await visibleToStudentFilter(
        studentId
      );

    const allowed =
      await Notification.exists({
        _id: notificationId,
        $and: [
          visibleFilter
        ]
      });

    if (!allowed) {
      throw ApiError.notFound(
        "Notification not found."
      );
    }

    notification.readBy =
      notification.readBy || [];

    const alreadyRead =
      notification.readBy.some(
        row =>
          String(row.student) ===
          String(studentId)
      );

    if (!alreadyRead) {
      notification.readBy.push({
        student: studentId,
        readAt: new Date()
      });

      await notification.save();
    }

    return sendSuccess(res, {
      message:
        "Notification marked as read.",
      data: {
        id: notification.id,
        isRead: true
      }
    });
  }

  throw ApiError.forbidden(
    "You are not allowed to mark notifications as read."
  );
});

const markAllRead = asyncHandler(async (req, res) => {
  let notifications;

  if (req.user.role === "student") {
    const filter =
      await visibleToStudentFilter(
        req.user.id
      );

    notifications =
      await Notification.find(filter);

    for (const notification of notifications) {
      const exists =
        notification.readBy.some(
          row =>
            String(row.student) ===
            String(req.user.id)
        );

      if (!exists) {
        notification.readBy.push({
          student: req.user.id,
          readAt: new Date()
        });

        await notification.save();
      }
    }
  } else {
    notifications =
      await Notification.find(
        scheduledVisibilityFilter()
      );

    for (const notification of notifications) {
      const exists =
        notification.readByOwner.some(
          row =>
            String(row.owner) ===
            String(req.user.id)
        );

      if (!exists) {
        notification.readByOwner.push({
          owner: req.user.id,
          readAt: new Date()
        });

        await notification.save();
      }
    }
  }

  sendSuccess(res, {
    message:
      "All notifications marked as read."
  });
});

module.exports = {
  list,
  sent,
  create,
  markRead,
  markAllRead
};
