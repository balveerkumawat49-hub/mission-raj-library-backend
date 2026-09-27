"use strict";

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyAccessToken } = require("../utils/tokens");
const Owner = require("../models/Owner");
const Learner = require("../models/Learner");

/**
 * Verifies the Bearer access token and attaches req.user = { id, role }.
 * Also loads a minimal live record so a deactivated/suspended account is
 * rejected immediately, even if its token has not expired yet.
 */
const authenticate = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw ApiError.unauthorized("Missing or invalid Authorization header.");
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch (error) {
    throw ApiError.unauthorized("Your session has expired. Please log in again.", "TOKEN_INVALID");
  }

  if (payload.role === "owner") {
    const owner = await Owner.findById(payload.sub);
    if (!owner || !owner.isActive) {
      throw ApiError.unauthorized("Account is no longer active.", "ACCOUNT_INACTIVE");
    }
    req.user = { id: owner.id, role: "owner", record: owner };
  } else if (payload.role === "student") {
    const learner = await Learner.findById(payload.sub);
    if (!learner || learner.accountStatus !== "active") {
      throw ApiError.unauthorized("Account is no longer active.", "ACCOUNT_INACTIVE");
    }
    req.user = { id: learner.id, role: "student", record: learner };
  } else {
    throw ApiError.unauthorized("Unrecognized token role.");
  }

  next();
});

/**
 * Restricts a route to one or more roles, e.g. requireRole("owner").
 */
function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(ApiError.forbidden("You do not have permission to access this resource."));
    }
    next();
  };
}

/**
 * For learner-scoped routes like /api/learners/:id - an owner may access
 * any record, but a student may only access their own. Reads the target
 * id from params.id by default, or from a custom field/query extractor.
 */
function requireSelfOrOwner(getTargetId) {
  return (req, _res, next) => {
    if (req.user.role === "owner") return next();

    const targetId = typeof getTargetId === "function" ? getTargetId(req) : req.params.id;

    if (!targetId || String(targetId) !== String(req.user.id)) {
      return next(ApiError.forbidden("You can only access your own records."));
    }

    next();
  };
}

module.exports = { authenticate, requireRole, requireSelfOrOwner };
