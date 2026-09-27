"use strict";

const router = require("express").Router();
const controller = require("../controllers/seat.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { createSeatValidators, updateSeatValidators } = require("../validators/seat.validator");

router.use(authenticate);

router.get("/", controller.list); // students read seats too (seat.html / dashboard)
router.post("/", requireRole("owner"), validate(createSeatValidators), controller.create);
router.patch("/:id", requireRole("owner"), validate(updateSeatValidators), controller.update);

module.exports = router;
