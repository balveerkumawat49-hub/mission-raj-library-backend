"use strict";

const router = require("express").Router();
const controller = require("../controllers/dashboard.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.get("/owner", authenticate, requireRole("owner"), controller.ownerDashboard);

module.exports = router;
