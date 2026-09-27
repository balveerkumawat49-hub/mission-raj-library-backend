"use strict";

const router = require("express").Router();
const controller = require("../controllers/attendance.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { checkInValidators } = require("../validators/attendance.validator");

router.use(authenticate);

router.get("/", controller.list);
router.post("/", requireRole("owner"), validate(checkInValidators), controller.create);
router.post("/:id/checkout", requireRole("owner"), controller.checkout);

module.exports = router;
