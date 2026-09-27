"use strict";

const ApiError = require("../utils/ApiError");
const Learner = require("../models/Learner");
const Attendance = require("../models/Attendance");
const SeatAllocation = require("../models/SeatAllocation");

function localDateString(date = new Date()) {
  // YYYY-MM-DD in server-local time; kept consistent across check-in/out
  // and date-filtered queries.
  const d = new Date(date);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

async function checkIn(studentId) {
  const student = await Learner.findById(studentId);
  if (!student) throw ApiError.notFound("Student not found.");

  const active = await Attendance.findOne({ student: studentId, checkOut: null });
  if (active) {
    throw ApiError.conflict(
      "This student is already checked in.",
      "ALREADY_CHECKED_IN"
    );
  }

  try {
    const now = new Date();

    // Capture the student's currently allocated seat at check-in time.
    // This creates historical accuracy: later seat changes/releases
    // must not alter where the student actually sat during this visit.
    const activeAllocation = await SeatAllocation.findOne({
      student: studentId,
      releasedAt: null
    }).select("seat");

    return await Attendance.create({
      student: studentId,
      seat: activeAllocation?.seat || null,
      date: localDateString(now),
      checkIn: now
    });
  } catch (error) {
    // The partial unique index is the final race-condition guard if two
    // check-in requests for the same student land concurrently.
    if (error.code === 11000) {
      throw ApiError.conflict("This student is already checked in.", "ALREADY_CHECKED_IN");
    }
    throw error;
  }
}

async function checkOut(attendanceId) {
  const record = await Attendance.findById(attendanceId);
  if (!record) throw ApiError.notFound("Attendance record not found.");
  if (record.checkOut) {
    throw ApiError.conflict("This attendance record is already checked out.", "ALREADY_CHECKED_OUT");
  }

  record.checkOut = new Date();
  record.durationMinutes = Math.round((record.checkOut - record.checkIn) / 60000);
  await record.save();
  return record;
}

module.exports = { checkIn, checkOut, localDateString };
