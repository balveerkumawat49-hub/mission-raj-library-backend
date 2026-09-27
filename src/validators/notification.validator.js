"use strict";

const { body } = require("express-validator");

const createNotificationValidators = [
  body("recipientType").isIn(["all", "group", "student"]).withMessage("Invalid recipientType."),
  body("recipientIds")
    .optional()
    .isArray()
    .withMessage("recipientIds must be an array."),
  body("title").trim().notEmpty().withMessage("Notification title is required."),
  body("message").trim().notEmpty().withMessage("Notification message is required."),
  body("priority").optional().isIn(["low", "normal", "high", "urgent"]),
  body("deliveryMode").optional().isIn(["now", "scheduled"]),
  body("scheduledAt").optional({ values: "falsy" }).isISO8601().toDate()
];

module.exports = { createNotificationValidators };
