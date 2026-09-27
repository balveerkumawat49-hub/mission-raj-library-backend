"use strict";

const asyncHandler =
  require("../utils/asyncHandler");

const ApiError =
  require("../utils/ApiError");

const { sendSuccess } =
  require("../utils/ApiResponse");

const NotificationRule =
  require("../models/NotificationRule");

const { recordAudit } =
  require("../services/auditLog.service");

const list =
  asyncHandler(async (_req, res) => {
    const rules =
      await NotificationRule.find()
        .sort({ createdAt: 1 });

    sendSuccess(res, {
      data: rules
    });
  });

const create =
  asyncHandler(async (req, res) => {
    const rule =
      await NotificationRule.create(
        req.body
      );

    await recordAudit({
      req,
      action:
        "notificationRule.create",
      targetType:
        "notificationRule",
      targetId:
        rule.id
    });

    sendSuccess(res, {
      statusCode: 201,
      message:
        "Notification rule created.",
      data: rule
    });
  });

const update =
  asyncHandler(async (req, res) => {
    const event =
      req.params.id;

    let rule =
      await NotificationRule.findOne({
        event
      });

    if (!rule) {
      rule =
        await NotificationRule.create({
          name:
            event.replaceAll(
              "_",
              " "
            ),
          event,
          active:
            req.body.active ??
            req.body.enabled ??
            true
        });
    } else {
      if (
        req.body.active !== undefined
      ) {
        rule.active =
          Boolean(
            req.body.active
          );
      }

      if (
        req.body.enabled !== undefined
      ) {
        rule.active =
          Boolean(
            req.body.enabled
          );
      }

      if (
        req.body.name !== undefined
      ) {
        rule.name =
          req.body.name;
      }

      if (
        req.body.daysBefore !== undefined
      ) {
        rule.daysBefore =
          Number(
            req.body.daysBefore
          );
      }

      await rule.save();
    }

    await recordAudit({
      req,
      action:
        "notificationRule.update",
      targetType:
        "notificationRule",
      targetId:
        rule.id
    });

    sendSuccess(res, {
      message:
        "Notification rule updated.",
      data: rule
    });
  });

module.exports = {
  list,
  create,
  update
};
