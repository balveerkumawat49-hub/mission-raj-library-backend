"use strict";

const { body } = require("express-validator");

const createPaymentValidators = [
  body("studentId").isMongoId().withMessage("A valid studentId is required."),
  body("amount").isFloat({ gt: 0 }).withMessage("Enter a valid payment amount."),
  body("paymentMode").trim().notEmpty().withMessage("Payment mode is required."),
  body("paymentDate").notEmpty().withMessage("Payment date is required.").isISO8601().toDate()
];

module.exports = { createPaymentValidators };
