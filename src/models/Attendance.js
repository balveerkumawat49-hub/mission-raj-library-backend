"use strict";

const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Learner", required: true },
    // Seat occupied by the student at check-in time.
    // Kept on the attendance record so later seat changes/releases
    // do not rewrite historical attendance.
    seat: { type: mongoose.Schema.Types.ObjectId, ref: "Seat", default: null },
    date: { type: String, required: true }, // YYYY-MM-DD, local library date
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 }
  },
  { timestamps: true }
);

// At most one active (not yet checked out) attendance record per student.
attendanceSchema.index(
  { student: 1 },
  { unique: true, partialFilterExpression: { checkOut: null } }
);
attendanceSchema.index({ date: 1 });

attendanceSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Attendance", attendanceSchema);
