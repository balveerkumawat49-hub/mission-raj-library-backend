"use strict";

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/ApiResponse");
const Settings = require("../models/Settings");
const { recordAudit } = require("../services/auditLog.service");

/**
 * There is exactly one settings document. It is created lazily on first
 * read so a fresh install doesn't need a special migration step.
 */
async function getOrCreateSettings() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  return settings;
}

const get = asyncHandler(async (_req, res) => {
  const settings = await getOrCreateSettings();
  sendSuccess(res, { data: settings });
});

const update = asyncHandler(async (req, res) => {
  const settings = await getOrCreateSettings();

  ["library", "operating", "attendance", "membership", "payment", "notifications"].forEach((group) => {
    if (req.body[group] && typeof req.body[group] === "object") {
      settings[group] = { ...(settings[group]?.toObject?.() ?? settings[group] ?? {}), ...req.body[group] };
      settings.markModified(group);
    }
  });

  await settings.save();

  await recordAudit({ req, action: "settings.update", targetType: "settings", targetId: settings.id });

  sendSuccess(res, { message: "Settings updated successfully.", data: settings });
});

module.exports = { get, update };
