"use strict";

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const ownerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    loginId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    email: { type: String, trim: true, lowercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, default: "owner", immutable: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

ownerSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

ownerSchema.statics.hashPassword = function hashPassword(plain) {
  return bcrypt.hash(plain, 12);
};

ownerSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model("Owner", ownerSchema);
