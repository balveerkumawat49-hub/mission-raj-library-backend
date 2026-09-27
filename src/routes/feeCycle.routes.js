"use strict";

const router = require("express").Router();

const controller = require("../controllers/feeCycle.controller");

const {
  authenticate,
  requireRole
} = require("../middleware/auth");

router.use(authenticate);

router.get(
  "/",
  requireRole("owner"),
  controller.list
);

module.exports = router;
