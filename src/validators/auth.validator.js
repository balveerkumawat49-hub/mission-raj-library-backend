"use strict";

const { body } = require("express-validator");

const loginValidators = [
  body("loginId").trim().notEmpty().withMessage("Login ID is required."),
  body("password").notEmpty().withMessage("Password is required."),
  body("role")
    .optional()
    .isIn(["owner", "student"])
    .withMessage("Role must be 'owner' or 'student'.")
];

const refreshValidators = [
  body("refreshToken").notEmpty().withMessage("refreshToken is required.")
];

const changePasswordValidators = [
  body("currentPassword").notEmpty().withMessage("currentPassword is required."),
  body("newPassword")
    .isLength({ min: 8 })
    .withMessage("newPassword must be at least 8 characters long.")
];

module.exports = { loginValidators, refreshValidators, changePasswordValidators };
