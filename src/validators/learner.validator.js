"use strict";

const { body, query } = require("express-validator");

const createLearnerValidators = [
  body("name").trim().notEmpty().withMessage("Student name is required."),
  body("mobile").trim().notEmpty().withMessage("Mobile number is required."),
  body("email").optional({ values: "falsy" }).isEmail().withMessage("Enter a valid email address."),
  body("admissionDate").notEmpty().withMessage("Admission date is required.").isISO8601().toDate(),
  body("membershipPlanId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid plan id."),
  body("membershipStart").optional({ values: "falsy" }).isISO8601().toDate(),
  body("membershipEnd").optional({ values: "falsy" }).isISO8601().toDate(),
  body("totalFee").optional().isFloat({ min: 0 }).withMessage("totalFee must be a positive number."),
  body("paidFee").optional().isFloat({ min: 0 }).withMessage("paidFee must be a positive number.")
];

const updateLearnerValidators = [
  body("name").optional().trim().notEmpty().withMessage("Student name cannot be empty."),
  body("mobile").optional().trim().notEmpty().withMessage("Mobile number cannot be empty."),
  body("email").optional({ values: "falsy" }).isEmail().withMessage("Enter a valid email address."),
  body("admissionDate").optional().isISO8601().toDate(),
  body("membershipPlanId").optional({ values: "falsy" }).isMongoId().withMessage("Invalid plan id."),
  body("membershipStart").optional({ values: "falsy" }).isISO8601().toDate(),
  body("membershipEnd").optional({ values: "falsy" }).isISO8601().toDate(),
  body("totalFee").optional().isFloat({ min: 0 }),
  body("paidFee").optional().isFloat({ min: 0 })
];

const listLearnerValidators = [
  query("page").optional().isInt({ min: 1 }).toInt(),
  query("limit").optional().isInt({ min: 1, max: 200 }).toInt()
];

module.exports = { createLearnerValidators, updateLearnerValidators, listLearnerValidators };
