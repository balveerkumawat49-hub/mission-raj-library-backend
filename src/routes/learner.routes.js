"use strict";

const router = require("express").Router();
const controller = require("../controllers/learner.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole, requireSelfOrOwner } = require("../middleware/auth");
const {
  createLearnerValidators,
  updateLearnerValidators,
  listLearnerValidators
} = require("../validators/learner.validator");

router.use(authenticate);

router.get("/", requireRole("owner"), validate(listLearnerValidators), controller.list);
router.post("/", requireRole("owner"), validate(createLearnerValidators), controller.create);

router.get("/:id", requireSelfOrOwner(), controller.getById);
router.patch("/:id", requireSelfOrOwner(), validate(updateLearnerValidators), controller.update);

module.exports = router;
