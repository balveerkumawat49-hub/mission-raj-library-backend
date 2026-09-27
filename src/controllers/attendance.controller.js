"use strict";

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/ApiResponse");
const Attendance = require("../models/Attendance");
const { checkIn, checkOut } = require("../services/attendance.service");
const { recordAudit } = require("../services/auditLog.service");

const list = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "student") {
    filter.student = req.user.id;
  } else if (req.query.studentId) {
    filter.student = req.query.studentId;
  }

  if (req.query.date) filter.date = req.query.date;

  const records = await Attendance.find(filter)
    .populate("student", "name studentId mobile")
    .populate("seat", "seatNumber floor zone status")
    .sort({ checkIn: -1 })
    .limit(500);

  sendSuccess(res, { data: records });
});

const create = asyncHandler(async (req, res) => {
  const record = await checkIn(req.body.studentId);

  await recordAudit({
    req,
    action: "attendance.checkin",
    targetType: "attendance",
    targetId: record.id,
    metadata: { studentId: req.body.studentId }
  });

  sendSuccess(res, { statusCode: 201, message: "Student checked in successfully.", data: record });
});

const checkout = asyncHandler(async (req, res) => {
  const record = await checkOut(req.params.id);

  await recordAudit({
    req,
    action: "attendance.checkout",
    targetType: "attendance",
    targetId: record.id
  });

  sendSuccess(res, { message: "Student checked out successfully.", data: record });
});

module.exports = { list, create, checkout };
