"use strict";

const path = require("path");
require("dotenv").config({
  path: path.resolve(process.cwd(), ".env")
});

/**
 * Centralised, validated environment configuration.
 * Fail fast at startup if a required secret is missing in non-test envs,
 * rather than silently running with an insecure default.
 */
function required(name, { allowEmptyInTest = true } = {}) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    if (process.env.NODE_ENV === "test" && allowEmptyInTest) {
      return `test-${name.toLowerCase()}`;
    }
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`
    );
  }

  return value;
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,

  databaseUrl: required("DATABASE_URL"),

  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtRefreshSecret: required("JWT_REFRESH_SECRET"),
  jwtAccessExpires: process.env.JWT_ACCESS_EXPIRES || "15m",
  jwtRefreshExpires: process.env.JWT_REFRESH_EXPIRES || "30d",

  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),

  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 300,
  authRateLimitMax: Number(process.env.AUTH_RATE_LIMIT_MAX) || 20,

  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || "",
  brevoSenderName: process.env.BREVO_SENDER_NAME || "Mission Library",
  emailAutomationEnabled:
    String(process.env.EMAIL_AUTOMATION_ENABLED || "false").toLowerCase() === "true",
  emailSandbox:
    String(process.env.EMAIL_SANDBOX || "false").toLowerCase() === "true",

  seedOwner: {
    name: process.env.SEED_OWNER_NAME || "Library Owner",
    loginId: process.env.SEED_OWNER_LOGIN_ID || "owner@missionraj.test",
    password: process.env.SEED_OWNER_PASSWORD || ""
  }
};

module.exports = env;
