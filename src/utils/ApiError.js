"use strict";

/**
 * Standard application error carrying an HTTP status code and a machine
 * readable error code. Thrown from anywhere in the app and translated
 * into the consistent JSON error shape by the global error handler.
 */
class ApiError extends Error {
  constructor(statusCode, message, code = "ERROR", details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, code = "BAD_REQUEST", details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = "Authentication required.", code = "UNAUTHORIZED") {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "You are not allowed to do that.", code = "FORBIDDEN") {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Resource not found.", code = "NOT_FOUND") {
    return new ApiError(404, message, code);
  }

  static conflict(message, code = "CONFLICT") {
    return new ApiError(409, message, code);
  }

  static unprocessable(message, code = "UNPROCESSABLE_ENTITY", details) {
    return new ApiError(422, message, code, details);
  }

  static tooMany(message = "Too many requests. Please slow down.", code = "RATE_LIMITED") {
    return new ApiError(429, message, code);
  }

  static internal(message = "Internal server error.", code = "INTERNAL_ERROR") {
    return new ApiError(500, message, code);
  }
}

module.exports = ApiError;
