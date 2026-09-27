"use strict";

const router = require("express").Router();
const controller = require("../controllers/settings.controller");
const { authenticate, requireRole } = require("../middleware/auth");

router.use(authenticate);

router.get("/", controller.get);
router.patch("/", requireRole("owner"), controller.update);
router.put("/", requireRole("owner"), controller.update);

module.exports = router;
