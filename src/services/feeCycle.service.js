"use strict";

const FeeCycle = require("../models/FeeCycle");
const ApiError = require("../utils/ApiError");

function monthLabel(date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric"
  }).format(new Date(date));
}

function normalizeDate(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function createRenewalCycle({
  student,
  plan,
  startDate,
  endDate,
  amount,
  session = null
}) {
  const periodStart = normalizeDate(startDate);
  const periodEnd = normalizeDate(endDate);

  if (periodEnd < periodStart) {
    throw ApiError.badRequest(
      "Membership end date cannot be before start date."
    );
  }

  const existing = await FeeCycle.findOne({
    student,
    periodStart,
    periodEnd
  }).session(session || null);

  if (existing) {
    throw ApiError.conflict(
      "A fee cycle already exists for this membership period."
    );
  }

  const rows = await FeeCycle.create(
    [
      {
        student,
        membershipStart: periodStart,
        membershipEnd: periodEnd,
        periodStart,
        periodEnd,
        periodLabel: monthLabel(periodStart),
        amount: Number(amount) || 0,
        paidAmount: 0,
        status: Number(amount) > 0 ? "pending" : "paid",
        plan: plan || null,
        source: "renewal"
      }
    ],
    session ? { session } : {}
  );

  return rows[0];
}

async function applyPaymentToCycle(cycleId, amount, session = null) {
  const cycle = await FeeCycle.findById(cycleId).session(session || null);

  if (!cycle) {
    throw ApiError.notFound("Fee cycle not found.");
  }

  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw ApiError.badRequest("Invalid cycle payment amount.");
  }

  const remaining = Math.max(
    0,
    Number(cycle.amount || 0) - Number(cycle.paidAmount || 0)
  );

  if (numericAmount > remaining) {
    throw ApiError.badRequest(
      `Payment exceeds this fee cycle. Remaining fee: ${remaining}.`
    );
  }

  cycle.paidAmount =
    Number(cycle.paidAmount || 0) + numericAmount;

  cycle.status =
    cycle.paidAmount >= Number(cycle.amount || 0)
      ? "paid"
      : "partial";

  await cycle.save(session ? { session } : undefined);

  return cycle;
}

async function listCycles(studentId) {
  return FeeCycle.find({ student: studentId })
    .sort({ periodStart: -1 })
    .populate(
      "plan",
      "name durationValue durationUnit price"
    );
}

module.exports = {
  createRenewalCycle,
  applyPaymentToCycle,
  listCycles
};
