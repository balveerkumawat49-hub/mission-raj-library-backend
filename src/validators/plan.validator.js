"use strict";

const { body } = require("express-validator");

const createPlanValidators = [
  body("name").trim().notEmpty().withMessage("Plan name is required."),
  body("durationValue").isFloat({ gt: 0 }).withMessage("Enter a valid duration."),
  body("durationUnit")
    .optional()
    .isIn(["day", "days", "week", "weeks", "month", "months", "year", "years"]),
  body("price").isFloat({ min: 0 }).withMessage("Enter a valid plan price."),
  body("status").optional().isIn(["active", "inactive"]),
  body("benefits").optional().isArray()
];

// PATCH is also used for the quick activate/deactivate toggle, which sends
// only { status }, so every field here is optional.
const updatePlanValidators = [
  body("name").optional().trim().notEmpty(),
  body("durationValue").optional().isFloat({ gt: 0 }),
  body("durationUnit")
    .optional()
    .isIn(["day", "days", "week", "weeks", "month", "months", "year", "years"]),
  body("price").optional().isFloat({ min: 0 }),
  body("status").optional().isIn(["active", "inactive"]),
  body("benefits").optional().isArray()
];

module.exports = { createPlanValidators, updatePlanValidators };
