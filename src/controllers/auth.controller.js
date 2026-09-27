"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Owner = require("../models/Owner");
const Learner = require("../models/Learner");
const RefreshToken = require("../models/RefreshToken");
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken
} = require("../utils/tokens");
const env = require("../config/env");
const { recordAudit } = require("../services/auditLog.service");

function refreshExpiryDate() {
  // Mirrors JWT_REFRESH_EXPIRES; stored separately so DB records expire too.
  const match = /^(\d+)([smhd])$/.exec(env.jwtRefreshExpires);
  const amount = match ? Number(match[1]) : 30;
  const unit = match ? match[2] : "d";
  const multiplier = { s: 1000, m: 60000, h: 3600000, d: 86400000 }[unit];
  return new Date(Date.now() + amount * multiplier);
}

async function issueSession(user, role) {
  const accessToken = signAccessToken({ id: user._id, role });
  const refreshToken = signRefreshToken({ id: user._id, role });

  await RefreshToken.create({
    tokenHash: hashToken(refreshToken),
    userId: user._id,
    role,
    expiresAt: refreshExpiryDate()
  });

  return { accessToken, refreshToken };
}

async function findByLoginId(loginId, role) {
  const normalized = String(loginId || "").trim().toLowerCase();

  if (role === "owner") {
    return { record: await Owner.findOne({ loginId: normalized }).select("+passwordHash"), role: "owner" };
  }
  if (role === "student") {
    return { record: await Learner.findOne({ loginId: normalized }).select("+passwordHash"), role: "student" };
  }

  const owner = await Owner.findOne({ loginId: normalized }).select("+passwordHash");
  if (owner) return { record: owner, role: "owner" };

  const learner = await Learner.findOne({ loginId: normalized }).select("+passwordHash");
  if (learner) return { record: learner, role: "student" };

  return { record: null, role: null };
}

const login = asyncHandler(async (req, res) => {
  const { loginId, password, role } = req.body;

  const { record, role: resolvedRole } = await findByLoginId(loginId, role);

  if (!record) {
    throw ApiError.unauthorized("Invalid Login ID or password.", "INVALID_CREDENTIALS");
  }

  if (resolvedRole === "owner" && !record.isActive) {
    throw ApiError.unauthorized("This account is no longer active.", "ACCOUNT_INACTIVE");
  }
  if (resolvedRole === "student" && record.accountStatus !== "active") {
    throw ApiError.unauthorized("This account is no longer active.", "ACCOUNT_INACTIVE");
  }

  const isValid = await record.comparePassword(password);
  if (!isValid) {
    throw ApiError.unauthorized("Invalid Login ID or password.", "INVALID_CREDENTIALS");
  }

  const { accessToken, refreshToken } = await issueSession(record, resolvedRole);

  req.user = { id: record.id, role: resolvedRole };
  await recordAudit({
    req,
    action: `${resolvedRole}.login`,
    targetType: resolvedRole,
    targetId: record.id
  });

  const redirect =
    resolvedRole === "owner" ? "owner/owner-dashboard.html" : "student/dashboard.html";

  sendSuccess(res, {
    message: "Login successful.",
    data: {
      accessToken,
      refreshToken,
      redirect,
      user: {
        id: record.id,
        name: record.name,
        role: resolvedRole,
        loginId: record.loginId
      }
    }
  });
});

const me = asyncHandler(async (req, res) => {
  const record = req.user.record;
  sendSuccess(res, {
    data: {
      id: record.id,
      role: req.user.role,
      name: record.name,
      loginId: record.loginId,
      email: record.email || "",
      ...(req.user.role === "student"
        ? { studentId: record.studentId, accountStatus: record.accountStatus }
        : {})
    }
  });
});

const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let payload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch {
    throw ApiError.unauthorized("Refresh token is invalid or expired.", "REFRESH_INVALID");
  }

  // An access token must never be usable as a refresh token, even if both
  // happened to be signed with the same secret - the "type" claim is the
  // explicit purpose check that closes that gap.
  if (payload.type !== "refresh") {
    throw ApiError.unauthorized("Refresh token is invalid or expired.", "REFRESH_INVALID");
  }

  const tokenHash = hashToken(refreshToken);

  // Atomically claim the token (find-and-revoke in one step) so that two
  // concurrent requests presenting the same refresh token cannot both pass
  // the "is it still valid" check before either one revokes it - only the
  // request that actually flips revokedAt from null wins.
  const stored = await RefreshToken.findOneAndUpdate(
    { tokenHash, revokedAt: null },
    { $set: { revokedAt: new Date() } },
    { new: false }
  );

  if (!stored || stored.expiresAt < new Date()) {
    throw ApiError.unauthorized("Refresh token is invalid or expired.", "REFRESH_INVALID");
  }

  const Model = payload.role === "owner" ? Owner : Learner;
  const record = await Model.findById(payload.sub);
  if (!record) {
    throw ApiError.unauthorized("Account no longer exists.", "ACCOUNT_NOT_FOUND");
  }

  const inactive = payload.role === "owner" ? !record.isActive : record.accountStatus !== "active";
  if (inactive) {
    throw ApiError.unauthorized("This account is no longer active.", "ACCOUNT_INACTIVE");
  }

  const { accessToken, refreshToken: newRefreshToken } = await issueSession(record, payload.role);

  sendSuccess(res, { data: { accessToken, refreshToken: newRefreshToken } });
});

const logout = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    await RefreshToken.updateOne(
      { tokenHash: hashToken(refreshToken) },
      { $set: { revokedAt: new Date() } }
    );
  }

  if (req.user) {
    await recordAudit({ req, action: `${req.user.role}.logout`, targetId: req.user.id });
  }

  sendSuccess(res, { message: "Logged out successfully." });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const Model = req.user.role === "owner" ? Owner : Learner;

  const record = await Model.findById(req.user.id).select("+passwordHash");
  if (!record || !record.passwordHash) {
    throw ApiError.badRequest("Password change is not available for this account.");
  }

  const isValid = await record.comparePassword(currentPassword);
  if (!isValid) {
    throw ApiError.unauthorized("Current password is incorrect.", "INVALID_CREDENTIALS");
  }

  record.passwordHash = await Model.hashPassword(newPassword);
  await record.save();

  // Revoke all existing refresh tokens so other sessions are logged out.
  await RefreshToken.updateMany(
    { userId: record._id, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );

  await recordAudit({ req, action: `${req.user.role}.change_password`, targetId: record.id });

  sendSuccess(res, { message: "Password updated successfully." });
});

module.exports = { login, me, refresh, logout, changePassword };
