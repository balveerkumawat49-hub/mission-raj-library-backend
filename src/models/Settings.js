"use strict";

const mongoose = require("mongoose");

/**
 * Singleton document (there is only ever one). `library` fields are
 * enumerated because owner/js/settings.js reads them individually
 * (normalizeSettings). The other groups (operating/attendance/membership/
 * payment/notifications) are stored as flexible Mixed objects so whatever
 * shape the settings form sends is persisted and echoed back verbatim -
 * the frontend already tolerates varying nested shapes by design.
 */
const settingsSchema = new mongoose.Schema(
  {
    library: {
      name: { type: String, default: "Mission Raj Library" },
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
      website: { type: String, default: "" },
      address: { type: String, default: "" },
      city: { type: String, default: "Kekri" },
      state: { type: String, default: "Rajasthan" }
    },
    operating: { type: mongoose.Schema.Types.Mixed, default: {} },
    attendance: { type: mongoose.Schema.Types.Mixed, default: {} },
    membership: { type: mongoose.Schema.Types.Mixed, default: {} },
    payment: { type: mongoose.Schema.Types.Mixed, default: {} },
    notifications: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

settingsSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Settings", settingsSchema);
