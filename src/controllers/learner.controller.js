"use strict";

const crypto = require("crypto");
const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Learner = require("../models/Learner");
const Plan = require("../models/Plan");
const SeatAllocation = require("../models/SeatAllocation");
const { recordAudit } = require("../services/auditLog.service");
const { recordPayment } = require("../services/payment.service");
const { sendStudentCreatedEmail, sendPaymentReceivedEmail } = require("../services/email.service");
const EmailLog = require("../models/EmailLog");

/**
 * Attaches each learner's currently active seat (if any) so the frontend's
 * normalizeStudent() seatName/seatId fallbacks have something to read,
 * without storing seatId redundantly on the learner document itself
 * (seat-allocations remains the single source of truth - see students.js
 * "AUDIT FIX" comment).
 */
async function attachActiveSeats(learners) {
  const ids = learners.map((l) => l._id);
  const allocations = await SeatAllocation.find({ student: { $in: ids }, releasedAt: null })
    .populate("seat", "seatNumber floor zone")
    .lean();

  const byStudent = new Map(allocations.map((a) => [String(a.student), a]));

  return learners.map((learner) => {
    const json = learner.toJSON ? learner.toJSON() : learner;
    const allocation = byStudent.get(String(learner._id));
    if (allocation && allocation.seat) {
      json.seat = { id: allocation.seat._id, number: allocation.seat.seatNumber };
      json.seatId = allocation.seat._id;
    }
    return json;
  });
}

function buildLearnerPayload(body) {
  const payload = {
    name: body.name,
    mobile: body.mobile,
    email: body.email,
    address: body.address,
    totalFee: body.totalFee !== undefined ? Number(body.totalFee) : undefined,
    paidFee: body.paidFee !== undefined ? Number(body.paidFee) : undefined,
    paymentMode: body.paymentMode
  };

  if (body.admissionDate) payload.admissionDate = body.admissionDate;

  if (body.membershipPlanId || body.membershipStart || body.membershipEnd) {
    payload.membership = {};
    if (body.membershipPlanId) payload.membership.planId = body.membershipPlanId;
    if (body.membershipStart) payload.membership.startDate = body.membershipStart;
    if (body.membershipEnd) payload.membership.endDate = body.membershipEnd;
  }

  Object.keys(payload).forEach((key) => payload[key] === undefined && delete payload[key]);
  return payload;
}

function planEndDate(start, plan) {
  const end = new Date(start);
  const unit = String(plan.durationUnit || "months").replace(/s$/, "");
  const value = Number(plan.durationValue) || 0;

  if (!Number.isInteger(value)) {
    end.setDate(end.getDate() + plan.durationInDays());
  } else if (unit === "day") {
    end.setDate(end.getDate() + value);
  } else if (unit === "week") {
    end.setDate(end.getDate() + value * 7);
  } else if (unit === "year") {
    end.setFullYear(end.getFullYear() + value);
  } else {
    end.setMonth(end.getMonth() + value);
  }

  return end;
}

/**
 * Merges the submitted membership fields into the learner's existing
 * membership (so a dates-only or plan-only change never drops the rest),
 * validates the plan, and derives the end date from the plan's duration
 * when a plan is assigned but no end date exists yet.
 */
async function buildMembership(incoming, existing = {}, fallbackStart = null) {
  let plan = null;

  if (incoming.planId) {
    plan = await Plan.findById(incoming.planId);
    if (!plan) throw ApiError.badRequest("Selected membership plan does not exist.");
    incoming.planName = plan.name;
  }

  const membership = { ...existing, ...incoming };

  if (membership.planId && !membership.endDate) {
    plan = plan || (await Plan.findById(membership.planId));
    if (plan) {
      if (!membership.startDate) membership.startDate = fallbackStart || new Date();
      membership.endDate = planEndDate(membership.startDate, plan);
    }
  }

  return membership;
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

const list = asyncHandler(async (req, res) => {
  const { search, status, membershipStatus, page = 1, limit = 50 } = req.query;

  const filter = {};
  if (status) filter.status = status;
  // Membership status is date-driven, so filter on the end date instead of
  // the stored status (which only refreshes when a record is saved).
  if (membershipStatus === "active") filter["membership.endDate"] = { $gte: startOfToday() };
  else if (membershipStatus === "expired") filter["membership.endDate"] = { $lt: startOfToday() };
  else if (membershipStatus === "pending") filter["membership.endDate"] = null;
  else if (membershipStatus) filter["membership.status"] = membershipStatus;
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    filter.$or = [
      { name: pattern },
      { mobile: pattern },
      { email: pattern },
      { studentId: pattern }
    ];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [learners, total] = await Promise.all([
    Learner.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Learner.countDocuments(filter)
  ]);

  const data = await attachActiveSeats(learners);

  sendSuccess(res, {
    data,
    meta: { total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / limit) || 1 }
  });
});

const getById = asyncHandler(async (req, res) => {
  const learner = await Learner.findById(req.params.id);
  if (!learner) throw ApiError.notFound("Student not found.");

  const [data] = await attachActiveSeats([learner]);
  sendSuccess(res, { data });
});

const create = asyncHandler(async (req, res) => {
  const payload = buildLearnerPayload(req.body);

  // Generate a unique persistent Student ID for every new learner.
  payload.studentId =
    `MRL-${new Date().getFullYear()}-${Date.now().toString(36).slice(-6).toUpperCase()}-${crypto.randomBytes(2).toString("hex").toUpperCase()}`;

  if (payload.membership) {
    payload.membership = await buildMembership(payload.membership, {}, payload.admissionDate);
  }

  // The audited frontend has no student self-registration flow (see
  // FRONTEND_COMPATIBILITY_REPORT.md), so the owner-create form is the only
  // place a student portal login can originate from. We auto-provision a
  // loginId (email if given, else mobile) and a one-time random password,
  // returned ONLY in this response so the owner can hand it to the student.
  const loginId = (payload.email || payload.mobile || "").toLowerCase().trim();
  let temporaryPassword;
  if (loginId) {
    temporaryPassword = crypto.randomBytes(6).toString("hex");
    payload.loginId = loginId;
    payload.passwordHash = await Learner.hashPassword(temporaryPassword);
  }

  // Initial admission payment must use the same Payment ledger/service
  // as payments added later from the Payments page.
  // Create the learner with paidFee = 0 first, then record the initial
  // payment through recordPayment() so Payment history, Payments page,
  // dashboard totals and learner.paidFee stay synchronized.
  const initialPaidFee = Number(payload.paidFee || 0);
  const initialPaymentMode = payload.paymentMode;

  if (initialPaidFee > 0) {
    delete payload.paidFee;
    delete payload.paymentMode;
  }

  let learner;

  try {
    learner = await Learner.create(payload);

    if (initialPaidFee > 0) {
      if (!initialPaymentMode) {
        throw ApiError.badRequest("Payment mode is required when an initial fee is paid.");
      }

      await recordPayment({
        studentId: learner.id,
        amount: initialPaidFee,
        paymentMode: initialPaymentMode,
        paymentDate: new Date(),
        purpose: "Admission fee",
        recordedBy: req.user.id
      });

      // Reload so the response contains the ledger-updated paidFee.
      learner = await Learner.findById(learner.id);
    }
  } catch (error) {
    // If initial payment creation fails on a standalone MongoDB,
    // remove the just-created learner so no half-created financial
    // record remains.
    if (learner?._id) {
      try {
        await Learner.deleteOne({ _id: learner._id });
      } catch (rollbackError) {
        error.rollbackError = rollbackError;
      }
    }
    throw error;
  }

  await recordAudit({ req, action: "learner.create", targetType: "learner", targetId: learner.id });

  // Automatic welcome email. Never blocks student creation if email fails.
  try {
    const emailResult = await sendStudentCreatedEmail(learner);

    if (emailResult?.skipped) {
      console.warn(
        "Student welcome email skipped:",
        emailResult.reason
      );
    } else {
      await EmailLog.updateOne(
      { eventKey: "STUDENT_CREATED:" + learner._id },
      {
        $set: {
          eventType: "STUDENT_CREATED",
          learner: learner._id,
          recipientEmail: learner.email,
          subject: "Mission Library — Membership Confirmed",
          status: "sent",
          sentAt: new Date()
        }
      },
        { upsert: true }
      );
    }
  } catch (emailError) {
    console.error("Automatic student welcome email failed:", emailError.message);
  }

  const data = learner.toJSON();
  if (temporaryPassword) {
    // Shown exactly once. It is never stored in plaintext or logged anywhere.
    data.portalCredentials = { loginId, temporaryPassword };
  }

  sendSuccess(res, { statusCode: 201, message: "Student created successfully.", data });
});

const update = asyncHandler(async (req, res) => {
  const learner = await Learner.findById(req.params.id);
  if (!learner) throw ApiError.notFound("Student not found.");

  let payload;
  if (req.user.role === "student") {
    // Students may only edit their own basic contact/profile fields.
    const allowed = ["name", "email", "address", "mobile"];
    payload = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) payload[key] = req.body[key];
    });
  } else {
    payload = buildLearnerPayload(req.body);

    // paidFee is controlled by the Payment ledger.
    // Owner student-edit must never overwrite it directly.
    delete payload.paidFee;
    delete payload.paymentMode;

    if (
      payload.totalFee !== undefined &&
      Number(payload.totalFee) < Number(learner.paidFee || 0)
    ) {
      throw ApiError.badRequest(
        "Total fee cannot be less than already paid fee."
      );
    }

    if (payload.membership) {
      payload.membership = await buildMembership(
        payload.membership,
        learner.toObject().membership || {}
      );
    }
  }

  Object.assign(learner, payload);
  await learner.save();

  await recordAudit({ req, action: "learner.update", targetType: "learner", targetId: learner.id });

  const [data] = await attachActiveSeats([learner]);
  sendSuccess(res, { message: "Student updated successfully.", data });
});

module.exports = { list, getById, create, update };
