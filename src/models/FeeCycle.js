"use strict";

const mongoose = require("mongoose");

const feeCycleSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Learner",
      required: true,
      index: true
    },

    membershipStart: {
      type: Date,
      required: true
    },

    membershipEnd: {
      type: Date,
      required: true
    },

    periodStart: {
      type: Date,
      required: true
    },

    periodEnd: {
      type: Date,
      required: true
    },

    periodLabel: {
      type: String,
      required: true,
      trim: true
    },

    amount: {
      type: Number,
      required: true,
      min: 0
    },

    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },

    status: {
      type: String,
      enum: ["pending", "partial", "paid"],
      default: "pending"
    },

    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      default: null
    },

    source: {
      type: String,
      enum: ["membership", "renewal", "legacy"],
      default: "renewal"
    }
  },
  { timestamps: true }
);

feeCycleSchema.index(
  { student: 1, periodStart: 1, periodEnd: 1 },
  { unique: true }
);

feeCycleSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("FeeCycle", feeCycleSchema);
