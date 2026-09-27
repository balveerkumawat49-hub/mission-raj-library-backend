"use strict";

const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const Seat = require("../models/Seat");
const Learner = require("../models/Learner");
const SeatAllocation = require("../models/SeatAllocation");

/**
 * Runs `work(session)` inside a MongoDB transaction when the deployment
 * supports one (replica set / Atlas). A local standalone `mongod` (common
 * in development) does not support multi-document transactions, so we
 * fall back to running the same steps without a session - the partial
 * unique indexes on SeatAllocation still prevent double-allocation races,
 * just without the extra atomicity of a transaction.
 */
async function withOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (/Transaction numbers are only allowed|IllegalOperation/i.test(error.message)) {
      return work(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
}

async function allocateSeat({ seatId, studentId }) {
  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const seat = await Seat.findById(seatId, null, opts);
    if (!seat) throw ApiError.notFound("Seat not found.");
    if (seat.status === "maintenance" || seat.status === "blocked") {
      throw ApiError.conflict(`Seat is marked as ${seat.status} and cannot be allocated.`);
    }

    const student = await Learner.findById(studentId, null, opts);
    if (!student) throw ApiError.notFound("Student not found.");

    const existingForSeat = await SeatAllocation.findOne(
      { seat: seatId, releasedAt: null },
      null,
      opts
    );
    if (existingForSeat) {
      throw ApiError.conflict("This seat is already occupied.", "SEAT_ALREADY_OCCUPIED");
    }

    const existingForStudent = await SeatAllocation.findOne(
      { student: studentId, releasedAt: null },
      null,
      opts
    );
    if (existingForStudent) {
      throw ApiError.conflict(
        "This student already has an active seat allocation. Release it first.",
        "STUDENT_ALREADY_SEATED"
      );
    }

    const [allocation] = await SeatAllocation.create([{ seat: seatId, student: studentId }], opts);

    seat.status = "occupied";
    await seat.save(opts);

    return allocation;
  });
}

async function releaseSeatBySeatId(seatId) {
  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const seat = await Seat.findById(seatId, null, opts);
    if (!seat) throw ApiError.notFound("Seat not found.");

    const allocation = await SeatAllocation.findOne({ seat: seatId, releasedAt: null }, null, opts);
    if (!allocation) {
      throw ApiError.badRequest("This seat has no active allocation to release.");
    }

    allocation.releasedAt = new Date();
    await allocation.save(opts);

    seat.status = "available";
    await seat.save(opts);

    return allocation;
  });
}

module.exports = { allocateSeat, releaseSeatBySeatId };
