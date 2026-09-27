"use strict";

const { body } = require("express-validator");

const checkInValidators = [
  body("studentId").isMongoId().withMessage("A valid studentId is required.")
];

module.exports = { checkInValidators };
