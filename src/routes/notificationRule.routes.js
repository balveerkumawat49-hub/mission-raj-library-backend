"use strict";

const router = require("express").Router();
const controller = require("../controllers/notificationRule.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.use(authenticate, requireRole("owner"));

router.get("/", controller.list);
router.post("/", controller.create);
router.patch("/:id", controller.update);

module.exports = router;
