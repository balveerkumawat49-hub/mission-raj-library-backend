"use strict";

const router = require("express").Router();
const controller = require("../controllers/payment.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { createPaymentValidators } = require("../validators/payment.validator");

router.use(authenticate);

router.get("/", controller.list);
router.get("/:id", controller.getById);
router.post("/", requireRole("owner"), validate(createPaymentValidators), controller.create);

module.exports = router;
