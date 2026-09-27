"use strict";

const winston = require("winston");

const isTest = process.env.NODE_ENV === "test";

/**
 * Application logger.
 *
 * IMPORTANT: never pass passwords, JWT secrets, refresh tokens, or full
 * request bodies containing sensitive personal data to this logger.
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isTest ? "error" : "info"),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaString = Object.keys(meta).length
        ? ` ${JSON.stringify(meta)}`
        : "";
      return `[${timestamp}] ${level.toUpperCase()}: ${message}${metaString}`;
    })
  ),
  transports: [new winston.transports.Console({ silent: isTest })]
});

module.exports = logger;
