"use strict";

const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: "Learner", required: true },
    amount: { type: Number, required: true, min: 0.01 },
    paymentMode: { type: String, required: true },
    paymentDate: { type: Date, required: true },
    reference: { type: String, default: "" },
    purpose: { type: String, default: "" },
    note: { type: String, default: "" },
    status: { type: String, enum: ["completed", "pending", "failed"], default: "completed" },
    recordedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Owner", default: null }
  },
  { timestamps: true }
);

paymentSchema.index({ paymentDate: 1 });

paymentSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Payment", paymentSchema);
