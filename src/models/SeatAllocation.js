"use strict";

const mongoose = require("mongoose");

/**
 * Single authoritative record of who is sitting where. An allocation with
 * releasedAt === null is the "active" allocation for that seat/student.
 * A partial unique index enforces at most one active allocation per seat
 * and per student at the database level, closing the race-condition gap
 * that simple application-level checks can miss under concurrent requests.
 */
const seatAllocationSchema = new mongoose.Schema(
  {
    seat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Learner", required: true },
    allocatedAt: { type: Date, default: Date.now },
    releasedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

seatAllocationSchema.index(
  { seat: 1 },
  { unique: true, partialFilterExpression: { releasedAt: null } }
);
seatAllocationSchema.index(
  { student: 1 },
  { unique: true, partialFilterExpression: { releasedAt: null } }
);

seatAllocationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("SeatAllocation", seatAllocationSchema);
