"use strict";

const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");
const env = require("../config/env");

/**
 * Every error - operational (ApiError) or a bug - ends up here, and every
 * response has the same shape:
 *   { success: false, message, error: { code, details? } }
 * Stack traces are never sent to the client, only logged server-side.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let error = err;

  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => e.message);
    error = ApiError.unprocessable("Validation failed.", "VALIDATION_ERROR", details);
  } else if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {}).join(", ") || "field";
    error = ApiError.conflict(`A record with that ${field} already exists.`, "DUPLICATE_KEY");
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Invalid identifier: ${err.value}`, "INVALID_ID");
  } else if (err.type === "entity.parse.failed") {
    error = ApiError.badRequest("Request body is not valid JSON.", "INVALID_JSON");
  } else if (err.type === "entity.too.large") {
    error = new ApiError(413, "Request body is too large.", "PAYLOAD_TOO_LARGE");
  } else if (!(err instanceof ApiError)) {
    logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
    error = ApiError.internal(
      env.nodeEnv === "production" ? "Internal server error." : err.message
    );
  }

  if (error.statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${error.statusCode} ${error.message}`);
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message,
    error: {
      code: error.code || "ERROR",
      ...(error.details ? { details: error.details } : {})
    }
  });
}

module.exports = errorHandler;
