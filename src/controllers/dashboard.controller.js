"use strict";

const asyncHandler = require("../utils/asyncHandler");
const { sendSuccess } = require("../utils/ApiResponse");
const Learner = require("../models/Learner");
const Seat = require("../models/Seat");
const Payment = require("../models/Payment");
const Attendance = require("../models/Attendance");
const { localDateString } = require("../services/attendance.service");

function startOfMonth() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}
function startOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
function endOfDay() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}
function daysFromNow(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

const ownerDashboard = asyncHandler(async (_req, res) => {
  const now = new Date();
  const today = localDateString(now);

  const [
    totalMembers,
    activeMembers,
    newMembers,
    expiredMembers,
    totalSeats,
    occupiedSeats,
    availableSeats,
    reservedSeats,
    maintenanceSeats,
    blockedSeats,
    todayCollectionAgg,
    monthCollectionAgg,
    pendingFeeAgg,
    renewalCollectionAgg,
    paymentCount,
    todayCheckins,
    currentlyInside,
    expiringSoon
  ] = await Promise.all([
    Learner.countDocuments({}),
    Learner.countDocuments({ "membership.endDate": { $gte: startOfDay() } }),
    Learner.countDocuments({ createdAt: { $gte: startOfMonth() } }),
    Learner.countDocuments({ "membership.endDate": { $lt: startOfDay() } }),
    Seat.countDocuments({}),
    Seat.countDocuments({ status: "occupied" }),
    Seat.countDocuments({ status: "available" }),
    Seat.countDocuments({ status: "reserved" }),
    Seat.countDocuments({ status: "maintenance" }),
    Seat.countDocuments({ status: "blocked" }),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: startOfDay(), $lte: endOfDay() } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payment.aggregate([
      { $match: { paymentDate: { $gte: startOfMonth() } } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Learner.aggregate([
      { $group: { _id: null, total: { $sum: { $subtract: ["$totalFee", "$paidFee"] } } } }
    ]),
    Payment.aggregate([
      { $match: { purpose: /renew/i } },
      { $group: { _id: null, total: { $sum: "$amount" } } }
    ]),
    Payment.countDocuments({}),
    Attendance.countDocuments({ date: today }),
    Attendance.countDocuments({ checkOut: null }),
    Learner.countDocuments({
      "membership.endDate": { $gte: now, $lte: daysFromNow(7) }
    })
  ]);

  sendSuccess(res, {
    data: {
      totalMembers,
      activeMembers,
      newMembers,
      expiredMembers,
      totalSeats,
      occupiedSeats,
      availableSeats,
      reservedSeats,
      maintenanceSeats,
      blockedSeats,
      todayCollection: todayCollectionAgg[0]?.total || 0,
      monthCollection: monthCollectionAgg[0]?.total || 0,
      pendingFees: Math.max(0, pendingFeeAgg[0]?.total || 0),
      renewalCollection: renewalCollectionAgg[0]?.total || 0,
      paymentCount,
      todayCheckins,
      currentlyInside,
      expiringSoon
    }
  });
});

module.exports = { ownerDashboard };
