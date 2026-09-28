"use strict";

const mongoose = require("mongoose");

const seatSchema = new mongoose.Schema(
  {
    seatNumber: { type: String, required: true, trim: true, unique: true },
    floor: { type: String, default: "" },
    zone: { type: String, default: "" },
    status: {
      // "available" / "occupied" are derived from SeatAllocation, but the
      // owner can also force a seat into "maintenance" or "blocked".
      type: String,
      enum: ["available", "occupied", "reserved", "maintenance", "blocked"],
      default: "available"
    },
    notes: { type: String, default: "" },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  { timestamps: true }
);

seatSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Seat", seatSchema);
