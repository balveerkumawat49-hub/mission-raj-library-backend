"use strict";

const router = require("express").Router();
const controller = require("../controllers/seatAllocation.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { allocateSeatValidators } = require("../validators/seat.validator");

router.use(authenticate);

router.get("/", controller.list);
router.post("/", requireRole("owner"), validate(allocateSeatValidators), controller.allocate);
router.post("/:seatId/release", requireRole("owner"), controller.release);

module.exports = router;
