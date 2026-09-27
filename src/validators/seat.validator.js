"use strict";

const { body } = require("express-validator");

const createSeatValidators = [
  body("seatNumber").trim().notEmpty().withMessage("Seat number is required."),
  body("status")
    .optional()
    .isIn(["available", "occupied", "reserved", "maintenance", "blocked"])
];

const updateSeatValidators = [
  body("seatNumber").optional().trim().notEmpty(),
  body("status")
    .optional()
    .isIn(["available", "occupied", "reserved", "maintenance", "blocked"])
];

const allocateSeatValidators = [
  body("seatId").isMongoId().withMessage("A valid seatId is required."),
  body("studentId").isMongoId().withMessage("A valid studentId is required.")
];

module.exports = { createSeatValidators, updateSeatValidators, allocateSeatValidators };
