"use strict";

/**
 * Wraps an async Express handler so any rejected promise / thrown error
 * is forwarded to next(), where the global error handler deals with it.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = asyncHandler;
