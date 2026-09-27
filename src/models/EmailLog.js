"use strict";

const mongoose = require("mongoose");

const emailLogSchema = new mongoose.Schema(
  {
    eventKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true
    },

    eventType: {
      type: String,
      required: true,
      trim: true
    },

    learner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Learner",
      default: null,
      index: true
    },

    payment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
      default: null
    },

    recipientEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true
    },

    subject: {
      type: String,
      default: ""
    },

    status: {
      type: String,
      enum: ["sent", "failed"],
      default: "sent"
    },

    messageId: {
      type: String,
      default: ""
    },

    error: {
      type: String,
      default: ""
    },

    sentAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

emailLogSchema.index({ learner: 1, eventType: 1, createdAt: -1 });
emailLogSchema.index({ payment: 1, eventType: 1 });

module.exports = mongoose.model("EmailLog", emailLogSchema);
