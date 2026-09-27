"use strict";

const router = require("express").Router();
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { authenticate } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimiter");
const {
  loginValidators,
  refreshValidators,
  changePasswordValidators
} = require("../validators/auth.validator");

router.post("/login", authLimiter, validate(loginValidators), controller.login);
router.post("/refresh", authLimiter, validate(refreshValidators), controller.refresh);
router.post("/logout", controller.logout);
router.get("/me", authenticate, controller.me);
router.post(
  "/change-password",
  authenticate,
  validate(changePasswordValidators),
  controller.changePassword
);

module.exports = router;
