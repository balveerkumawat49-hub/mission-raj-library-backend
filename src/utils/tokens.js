"use strict";

const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const env = require("../config/env");

/**
 * Access tokens carry only the minimum identity claims needed for RBAC.
 * Never put sensitive personal data inside a JWT payload - it is not
 * encrypted, only signed, and frequently ends up in logs/browser storage.
 */
function signAccessToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    env.jwtAccessSecret,
    { expiresIn: env.jwtAccessExpires }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwtAccessSecret);
}

function signRefreshToken(user) {
  return jwt.sign(
    { sub: String(user.id), role: user.role, type: "refresh" },
    env.jwtRefreshSecret,
    { expiresIn: env.jwtRefreshExpires }
  );
}

function verifyRefreshToken(token) {
  return jwt.verify(token, env.jwtRefreshSecret);
}

/**
 * Refresh tokens are stored server-side only as a SHA-256 hash, never in
 * plaintext, so a database leak alone cannot be used to mint new sessions.
 */
function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
};
