"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Seat = require("../models/Seat");
const SeatAllocation = require("../models/SeatAllocation");
const { recordAudit } = require("../services/auditLog.service");

/**
 * Enriches each seat with its currently active occupant (if any), which
 * owner/js/seats.js and seat-chart.js read as seat.student.{id,name}.
 */
async function attachOccupants(seats) {
  const allocations = await SeatAllocation.find({
    seat: { $in: seats.map((s) => s._id) },
    releasedAt: null
  })
    .populate("student", "name studentId mobile membership")
    .lean();

  const bySeat = new Map(allocations.map((a) => [String(a.seat), a]));

  return seats.map((seat) => {
    const json = seat.toJSON ? seat.toJSON() : seat;
    const allocation = bySeat.get(String(seat._id));
    if (allocation && allocation.student) {
      json.student = {
        id: allocation.student._id,
        name: allocation.student.name,
        studentId: allocation.student.studentId,
        mobile: allocation.student.mobile,
        membership: allocation.student.membership
      };
      json.allocationId = allocation._id;
    }
    return json;
  });
}

const list = asyncHandler(async (req, res) => {
  const seats = await Seat.find().sort({ seatNumber: 1 });
  const data = await attachOccupants(seats);
  sendSuccess(res, { data });
});

const create = asyncHandler(async (req, res) => {
  const { seatNumber, floor, zone, status, notes } = req.body;
  const seat = await Seat.create({ seatNumber, floor, zone, status, notes });

  await recordAudit({ req, action: "seat.create", targetType: "seat", targetId: seat.id });

  sendSuccess(res, { statusCode: 201, message: "Seat created successfully.", data: seat });
});

const update = asyncHandler(async (req, res) => {
  const seat = await Seat.findById(req.params.id);
  if (!seat) throw ApiError.notFound("Seat not found.");

  // "occupied" and "available" are derived from the active SeatAllocation
  // record, not set directly - allowing a manual override here is what lets
  // the seat's status drift out of sync with the actual allocation.
  if (req.body.status !== undefined && req.body.status !== seat.status) {
    const activeAllocation = await SeatAllocation.findOne({ seat: seat._id, releasedAt: null });

    if (req.body.status !== "occupied" && activeAllocation) {
      throw ApiError.conflict(
        "This seat currently has an active allocation. Release it before changing its status.",
        "SEAT_HAS_ACTIVE_ALLOCATION"
      );
    }
    if (req.body.status === "occupied" && !activeAllocation) {
      throw ApiError.conflict(
        "Seat status cannot be set to occupied without an active allocation.",
        "SEAT_NOT_ALLOCATED"
      );
    }
  }

  ["seatNumber", "floor", "zone", "status", "notes", "x", "y"].forEach((field) => {
    if (req.body[field] !== undefined) seat[field] = req.body[field];
  });

  await seat.save();

  await recordAudit({ req, action: "seat.update", targetType: "seat", targetId: seat.id });

  const [data] = await attachOccupants([seat]);
  sendSuccess(res, { message: "Seat updated successfully.", data });
});

module.exports = { list, create, update };
