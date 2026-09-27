"use strict";

/**
 * Sends a consistent success envelope: { success: true, message, data }.
 * The existing frontend's apiRequest()/unwrapList()/unwrapObject() helpers
 * already know how to read `data` (array or object), so every endpoint
 * uses this single shape.
 */
function sendSuccess(res, { statusCode = 200, message = "OK", data = null, meta } = {}) {
  const body = { success: true, message, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

module.exports = { sendSuccess };
