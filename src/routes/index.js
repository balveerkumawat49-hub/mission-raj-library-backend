"use strict";

const router = require("express").Router();

router.use("/auth", require("./auth.routes"));
router.use("/learners", require("./learner.routes"));
router.use("/plans", require("./plan.routes"));
router.use("/seats", require("./seat.routes"));
router.use("/seat-allocations", require("./seatAllocation.routes"));
router.use("/attendance", require("./attendance.routes"));
router.use("/payments", require("./payment.routes"));
router.use("/notifications", require("./notification.routes"));
router.use("/notification-rules", require("./notificationRule.routes"));
router.use("/dashboard", require("./dashboard.routes"));

// Settings is mounted at three paths for frontend compatibility - see
// owner/js/settings.js, which tries "/api/settings/library" first, then
// falls back to "/api/library-settings" and "/api/settings".
const settingsRoutes = require("./settings.routes");
router.use("/settings/library", settingsRoutes);
router.use("/settings", settingsRoutes);
router.use("/library-settings", settingsRoutes);

module.exports = router;
