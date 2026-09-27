"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

/**
 * Field names below intentionally mirror what owner/js/students.js and
 * student/js/*.js send and read (see the payload built in students.js
 * around "const payload = { name, mobile, email, address, admissionDate,
 * membershipPlanId, membershipStart, membershipEnd, totalFee, paidFee,
 * paymentMode }"), plus normalizeStudent()'s generous fallbacks
 * (student._id/id, student.mobile/phone, membership.startDate/endDate...).
 * seatId is deliberately NOT stored here - seat-allocations is the single
 * source of truth for seat assignment (see SeatAllocation.js).
 */
const learnerSchema = new mongoose.Schema(
  {
    studentId: {
      // Human-friendly admission/registration code, e.g. MRL-0001.
      type: String,
      unique: true,
      sparse: true,
      trim: true
    },
    name: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    address: { type: String, trim: true, default: "" },

    admissionDate: { type: Date, required: true },

    membership: {
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "Plan", default: null },
      planName: { type: String, default: "" },
      startDate: { type: Date, default: null },
      endDate: { type: Date, default: null },
      status: {
        type: String,
        enum: ["active", "expired", "pending"],
        default: "pending"
      }
    },

    totalFee: { type: Number, default: 0, min: 0 },
    paidFee: { type: Number, default: 0, min: 0 },
    paymentMode: { type: String, default: "" },

    status: {
      type: String,
      enum: ["active", "inactive", "expired", "pending"],
      default: "active"
    },

    // Login credentials for the learner/student portal.
    loginId: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    accountStatus: {
      type: String,
      enum: ["active", "suspended"],
      default: "active"
    }
  },
  { timestamps: true }
);

learnerSchema.index({ name: "text", mobile: "text", email: "text", studentId: "text" });

learnerSchema.methods.comparePassword = function comparePassword(candidate) {
  if (!this.passwordHash) return Promise.resolve(false);
  return bcrypt.compare(candidate, this.passwordHash);
};

learnerSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

learnerSchema.virtual("pendingFee").get(function pendingFee() {
  return Math.max(0, (this.totalFee || 0) - (this.paidFee || 0));
});

function recalculateMembershipStatus(doc) {
  if (!doc.membership || !doc.membership.endDate) {
    if (doc.membership) doc.membership.status = "pending";
    return;
  }
  const now = new Date();
  const end = new Date(doc.membership.endDate);
  end.setHours(23, 59, 59, 999);
  doc.membership.status = end >= now ? "active" : "expired";
}

learnerSchema.pre("save", function preSave(next) {
  recalculateMembershipStatus(this);
  next();
});

learnerSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    // Stored status only refreshes on save; report the current one.
    if (ret.membership) recalculateMembershipStatus(ret);
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Learner", learnerSchema);
module.exports.recalculateMembershipStatus = recalculateMembershipStatus;
