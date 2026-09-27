"use strict";

const rateLimit = require("express-rate-limit");
const env = require("../config/env");

const generalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests. Please slow down.", error: { code: "RATE_LIMITED" } }
});

// Tighter limit on auth endpoints to slow down credential stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.authRateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many attempts. Please try again later.", error: { code: "RATE_LIMITED" } }
});

module.exports = { generalLimiter, authLimiter };
