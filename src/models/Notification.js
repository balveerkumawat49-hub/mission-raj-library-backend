"use strict";

const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientType: {
      type: String,
      enum: ["all", "group", "student"],
      required: true
    },

    recipientIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Learner"
      }
    ],

    group: {
      type: String,
      default: null
    },

    type: {
      type: String,
      default: "general"
    },

    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal"
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    message: {
      type: String,
      required: true,
      trim: true
    },

    deliveryMode: {
      type: String,
      enum: ["now", "scheduled"],
      default: "now"
    },

    scheduledAt: {
      type: Date,
      default: null
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Owner",
      default: null
    },

    // Student-specific read state.
    readBy: [
      {
        student: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Learner"
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ],

    // Owner-specific read state.
    readByOwner: [
      {
        owner: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Owner"
        },
        readAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  {
    timestamps: true
  }
);

notificationSchema.index({
  recipientType: 1,
  recipientIds: 1
});

notificationSchema.index({
  "readBy.student": 1
});

notificationSchema.index({
  "readByOwner.owner": 1
});

notificationSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model(
  "Notification",
  notificationSchema
);
