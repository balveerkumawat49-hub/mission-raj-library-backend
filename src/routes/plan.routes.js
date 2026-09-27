"use strict";

const router = require("express").Router();
const controller = require("../controllers/plan.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { createPlanValidators, updatePlanValidators } = require("../validators/plan.validator");

router.use(authenticate);

// Both owner and student portals read plans (students see plan options on
// their membership page); only the owner can create/modify them.
router.get("/", controller.list);
router.post("/", requireRole("owner"), validate(createPlanValidators), controller.create);
router.patch("/:id", requireRole("owner"), validate(updatePlanValidators), controller.update);

module.exports = router;
