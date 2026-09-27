"use strict";

const AuditLog = require("../models/AuditLog");
const logger = require("../utils/logger");

/**
 * Fire-and-forget audit trail for sensitive administrative actions
 * (logins, learner/plan/seat/attendance/payment/notification/settings
 * changes, password changes). Never pass secrets/passwords/tokens in
 * `metadata`.
 */
async function recordAudit({ req, action, targetType = "", targetId = "", metadata = {} }) {
  try {
    await AuditLog.create({
      actorId: req.user ? req.user.id : null,
      actorRole: req.user ? req.user.role : "system",
      action,
      targetType,
      targetId: String(targetId || ""),
      metadata,
      ip: req.ip
    });
  } catch (error) {
    // Audit logging must never break the primary request.
    logger.warn(`Failed to write audit log for "${action}": ${error.message}`);
  }
}

module.exports = { recordAudit };
