"use strict";

const mongoose = require("mongoose");
const ApiError = require("../utils/ApiError");
const Payment = require("../models/Payment");
const Learner = require("../models/Learner");

/**
 * Same optional-transaction fallback used by seatAllocation.service.js:
 * runs inside a MongoDB transaction when supported (replica set / Atlas),
 * and falls back to sequential writes on a standalone mongod.
 */
async function withOptionalTransaction(work) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } catch (error) {
    if (/Transaction numbers are only allowed|IllegalOperation/i.test(error.message)) {
      return work(null);
    }
    throw error;
  } finally {
    session.endSession();
  }
}

/**
 * Records a payment and increments the learner's paidFee ledger as a single
 * atomic unit when MongoDB transactions are available. On standalone MongoDB,
 * a compensating rollback removes the payment if the learner ledger update
 * fails after payment creation.
 */
async function recordPayment({
  studentId,
  amount,
  paymentMode,
  paymentDate,
  reference,
  purpose,
  note,
  recordedBy
}) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw ApiError.badRequest("Enter a valid payment amount.");
  }

  return withOptionalTransaction(async (session) => {
    const opts = session ? { session } : {};

    const student = await Learner.findById(studentId, null, opts);
    if (!student) throw ApiError.notFound("Student not found.");

    const currentPaidFee = Number(student.paidFee || 0);
    const totalFee = Number(student.totalFee || 0);

    if (currentPaidFee + numericAmount > totalFee) {
      throw ApiError.badRequest(
        `Payment exceeds the remaining fee. Remaining fee: ${Math.max(
          0,
          totalFee - currentPaidFee
        )}.`
      );
    }

    const [payment] = await Payment.create(
      [
        {
          student: studentId,
          amount: numericAmount,
          paymentMode,
          paymentDate,
          reference,
          purpose,
          note,
          recordedBy
        }
      ],
      opts
    );

    try {
      const updateResult = await Learner.updateOne(
        { _id: studentId },
        { $inc: { paidFee: numericAmount } },
        opts
      );

      if (updateResult.matchedCount !== 1) {
        throw ApiError.notFound("Student not found.");
      }
    } catch (error) {
      if (!session) {
        try {
          await Payment.deleteOne({ _id: payment._id });
        } catch (rollbackError) {
          error.rollbackError = rollbackError;
        }
      }
      throw error;
    }

    return payment;
  });
}

module.exports = { recordPayment };
