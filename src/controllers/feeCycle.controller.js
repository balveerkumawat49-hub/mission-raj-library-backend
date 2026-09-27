"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const FeeCycle = require("../models/FeeCycle");

const list = asyncHandler(async (req, res) => {
  const studentId = req.query.studentId;

  if (!studentId) {
    throw ApiError.badRequest("studentId is required.");
  }

  const cycles = await FeeCycle.find({
    student: studentId
  })
    .sort({ periodStart: -1 })
    .populate(
      "plan",
      "name durationValue durationUnit price"
    );

  sendSuccess(res, { data: cycles });
});

module.exports = { list };
