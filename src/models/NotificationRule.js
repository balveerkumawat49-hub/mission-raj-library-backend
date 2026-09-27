"use strict";

const mongoose = require("mongoose");

const notificationRuleSchema =
  new mongoose.Schema(
    {
      name: {
        type: String,
        required: true,
        trim: true
      },

      event: {
        type: String,
        enum: [
          "STUDENT_CREATED",
          "FEE_DUE",
          "FEE_OVERDUE",
          "SEAT_EXPIRING",
          "SEAT_EXPIRED",
          "ATTENDANCE_ALERT",
          "custom"
        ],
        required: true,
        unique: true
      },

      daysBefore: {
        type: Number,
        default: 0
      },

      titleTemplate: {
        type: String,
        default: ""
      },

      messageTemplate: {
        type: String,
        default: ""
      },

      active: {
        type: Boolean,
        default: true
      }
    },
    {
      timestamps: true
    }
  );

notificationRuleSchema.set(
  "toJSON",
  {
    transform: (_doc, ret) => {
      delete ret.__v;
      return ret;
    }
  }
);

module.exports =
  mongoose.model(
    "NotificationRule",
    notificationRuleSchema
  );
