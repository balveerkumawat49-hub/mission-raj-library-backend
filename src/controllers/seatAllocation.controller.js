"use strict";

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/ApiResponse");
const SeatAllocation = require("../models/SeatAllocation");
const { allocateSeat, releaseSeatBySeatId } = require("../services/seatAllocation.service");
const { recordAudit } = require("../services/auditLog.service");

const list = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "student") {
    // A learner may only ever see their own seat-allocation history.
    filter.student = req.user.id;
  } else if (req.query.studentId) {
    filter.student = req.query.studentId;
  }

  if (req.query.active === "true") filter.releasedAt = null;

  const allocations = await SeatAllocation.find(filter)
    .populate("seat", "seatNumber floor zone status")
    .populate("student", "name studentId")
    .sort({ createdAt: -1 });

  sendSuccess(res, { data: allocations });
});

const allocate = asyncHandler(async (req, res) => {
  const { seatId, studentId } = req.body;
  const allocation = await allocateSeat({ seatId, studentId });

  await recordAudit({
    req,
    action: "seat.allocate",
    targetType: "seatAllocation",
    targetId: allocation.id,
    metadata: { seatId, studentId }
  });

  sendSuccess(res, { statusCode: 201, message: "Seat allocated successfully.", data: allocation });
});

const release = asyncHandler(async (req, res) => {
  const allocation = await releaseSeatBySeatId(req.params.seatId);

  await recordAudit({
    req,
    action: "seat.release",
    targetType: "seatAllocation",
    targetId: allocation.id,
    metadata: { seatId: req.params.seatId }
  });

  sendSuccess(res, { message: "Seat released successfully.", data: allocation });
});

module.exports = { list, allocate, release };
