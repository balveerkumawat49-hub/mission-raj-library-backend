"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const { sendSuccess } = require("../utils/ApiResponse");
const Payment = require("../models/Payment");
const { recordAudit } = require("../services/auditLog.service");
const { recordPayment } = require("../services/payment.service");
const { sendPaymentReceivedEmail } = require("../services/email.service");
const EmailLog = require("../models/EmailLog");

const list = asyncHandler(async (req, res) => {
  const filter = {};

  if (req.user.role === "student") {
    filter.student = req.user.id;
  } else if (req.query.studentId) {
    filter.student = req.query.studentId;
  }

  const payments = await Payment.find(filter)
    .populate("student", "name studentId totalFee paidFee mobile")
    .sort({ paymentDate: -1 })
    .limit(500);

  sendSuccess(res, { data: payments });
});

const getById = asyncHandler(async (req, res) => {
  const payment = await Payment.findById(req.params.id).populate("student", "name studentId totalFee paidFee mobile");
  if (!payment) throw ApiError.notFound("Payment not found.");

  if (req.user.role === "student" && String(payment.student._id) !== String(req.user.id)) {
    throw ApiError.forbidden("You can only view your own payments.");
  }

  sendSuccess(res, { data: payment });
});

const create = asyncHandler(async (req, res) => {
  const { studentId, amount, paymentMode, paymentDate, reference, purpose, note } = req.body;

  // Payment save + learner paidFee update happen atomically inside
  // recordPayment(), so a partial failure never leaves financial data
  // inconsistent.
  const payment = await recordPayment({
    studentId,
    amount,
    paymentMode,
    paymentDate,
    reference,
    purpose,
    note,
    recordedBy: req.user.id
  });

  await recordAudit({
    req,
    action: "payment.create",
    targetType: "payment",
    targetId: payment.id,
    metadata: { studentId, amount }
  });

  // Automatic payment confirmation email. Never blocks payment recording.
  try {
    const learnerForEmail = await require("../models/Learner").findById(studentId);
    if (learnerForEmail) {
      const emailResult = await sendPaymentReceivedEmail(learnerForEmail, payment);

      if (!emailResult?.skipped) {
        await EmailLog.updateOne(
          { eventKey: "PAYMENT_RECEIVED:" + payment._id },
          {
            $set: {
              eventType: "PAYMENT_RECEIVED",
              learner: learnerForEmail._id,
              payment: payment._id,
              recipientEmail: learnerForEmail.email,
              subject: "Mission Library — Payment Received",
              status: "sent",
              sentAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }
  } catch (emailError) {
    console.error("Automatic payment confirmation email failed:", emailError.message);
  }

  sendSuccess(res, { statusCode: 201, message: "Payment recorded successfully.", data: payment });
});

module.exports = { list, getById, create };
