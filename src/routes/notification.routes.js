"use strict";

const router = require("express").Router();
const controller = require("../controllers/notification.controller");
const validate = require("../middleware/validate");
const { authenticate, requireRole } = require("../middleware/auth");
const { createNotificationValidators } = require("../validators/notification.validator");

router.use(authenticate);

router.get("/sent", requireRole("owner"), controller.sent);
router.get("/", controller.list);
router.post("/", requireRole("owner"), validate(createNotificationValidators), controller.create);
router.patch("/read-all", controller.markAllRead);
router.patch("/:id/read", controller.markRead);

module.exports = router;
