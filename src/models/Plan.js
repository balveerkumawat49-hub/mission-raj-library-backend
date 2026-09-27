"use strict";

const mongoose = require("mongoose");

const planSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationValue: { type: Number, required: true, min: 1 },
    durationUnit: {
      type: String,
      enum: ["day", "days", "week", "weeks", "month", "months", "year", "years"],
      default: "months"
    },
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    description: { type: String, default: "" },
    benefits: { type: [String], default: [] }
  },
  { timestamps: true }
);

planSchema.methods.durationInDays = function durationInDays() {
  const unit = this.durationUnit.replace(/s$/, "");
  const map = { day: 1, week: 7, month: 30, year: 365 };
  return (map[unit] || 30) * this.durationValue;
};

planSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Plan", planSchema);
