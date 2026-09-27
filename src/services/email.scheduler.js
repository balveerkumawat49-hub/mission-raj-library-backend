"use strict";

const cron = require("node-cron");
const Learner = require("../models/Learner");
const Payment = require("../models/Payment");
const EmailLog = require("../models/EmailLog");
const env = require("../config/env");
const logger = require("../utils/logger");

const {
  isConfigured,
  sendStudentCreatedEmail,
  sendPaymentReceivedEmail,
  sendFeeReminderEmail,
  sendMembershipExpiringEmail
} = require("./email.service");

function dayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dateKey(date) {
  const d = new Date(date);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

async function alreadySent(eventKey) {
  return Boolean(await EmailLog.exists({ eventKey }));
}

async function logEmail({
  eventKey,
  eventType,
  learner,
  payment = null,
  email,
  subject,
  result
}) {
  await EmailLog.updateOne(
    { eventKey },
    {
      $setOnInsert: {
        eventKey,
        eventType,
        learner,
        payment,
        recipientEmail: email,
        subject,
        status: "sent",
        messageId: result?.messageId || "",
        sentAt: new Date()
      }
    },
    { upsert: true }
  );
}

async function processOneEmail({
  eventKey,
  eventType,
  learner,
  payment = null,
  send
}) {
  if (!learner?.email) return;

  if (await alreadySent(eventKey)) return;

  try {
    const result = await send();

    if (result?.skipped) return;

    await logEmail({
      eventKey,
      eventType,
      learner: learner._id,
      payment: payment?._id || null,
      email: learner.email,
      subject: eventType,
      result
    });

    logger.info(`Automatic email sent: ${eventType} -> ${learner.email}`);
  } catch (error) {
    logger.error(
      `Automatic email failed [${eventType}] ${learner.email}: ${error.message}`
    );
  }
}

async function processNewStudents() {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const learners = await Learner.find({
    email: { $exists: true, $nin: ["", null] },
    createdAt: { $gte: from, $lte: now }
  }).limit(100);

  for (const learner of learners) {
    await processOneEmail({
      eventKey: `STUDENT_CREATED:${learner._id}`,
      eventType: "STUDENT_CREATED",
      learner,
      send: () => sendStudentCreatedEmail(learner)
    });
  }
}

async function processPayments() {
  const now = new Date();
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const payments = await Payment.find({
    createdAt: { $gte: from, $lte: now },
    status: "completed"
  })
    .populate("student")
    .limit(100);

  for (const payment of payments) {
    const learner = payment.student;

    await processOneEmail({
      eventKey: `PAYMENT_RECEIVED:${payment._id}`,
      eventType: "PAYMENT_RECEIVED",
      learner,
      payment,
      send: () => sendPaymentReceivedEmail(learner, payment)
    });
  }
}

async function processMembershipAndFees() {
  const today = dayStart();

  const learners = await Learner.find({
    email: { $exists: true, $nin: ["", null] },
    status: { $ne: "inactive" }
  }).limit(5000);

  for (const learner of learners) {
    if (!learner.membership?.endDate) continue;

    const end = dayStart(learner.membership.endDate);
    const diffDays = Math.round(
      (end.getTime() - today.getTime()) /
      86400000
    );

    const pendingFee =
      Number(learner.totalFee || 0) -
      Number(learner.paidFee || 0);

    /*
     * Membership expiry reminders:
     * 7, 3, 1 and 0 days before/on expiry.
     */
    if ([7, 3, 1, 0].includes(diffDays)) {
      await processOneEmail({
        eventKey: `MEMBERSHIP_EXPIRY:${learner._id}:${dateKey(today)}:${diffDays}`,
        eventType: `MEMBERSHIP_EXPIRY_${diffDays}`,
        learner,
        send: () =>
          sendMembershipExpiringEmail(
            learner,
            diffDays
          )
      });
    }

    /*
     * Existing backend has no separate feeDueDate field.
     * Therefore membership endDate is used as the current
     * fee-cycle due-date proxy.
     */
    if (pendingFee > 0 && diffDays === 0) {
      await processOneEmail({
        eventKey: `FEE_DUE:${learner._id}:${dateKey(today)}`,
        eventType: "FEE_DUE",
        learner,
        send: () => sendFeeReminderEmail(learner, "due")
      });
    }

    if (pendingFee > 0 && diffDays < 0) {
      await processOneEmail({
        eventKey: `FEE_OVERDUE:${learner._id}:${dateKey(today)}`,
        eventType: "FEE_OVERDUE",
        learner,
        send: () => sendFeeReminderEmail(learner, "overdue")
      });
    }
  }
}

async function runEmailAutomation() {
  if (!env.emailAutomationEnabled) return;

  if (!isConfigured()) {
    logger.warn(
      "Email automation is enabled but Brevo credentials are not configured."
    );
    return;
  }

  try {
    await processNewStudents();
    await processPayments();
    await processMembershipAndFees();
  } catch (error) {
    logger.error(
      `Email automation cycle failed: ${error.message}`
    );
  }
}

function startEmailScheduler() {
  if (!env.emailAutomationEnabled) {
    logger.info("Email automation is disabled.");
    return null;
  }

  /*
   * Every 5 minutes:
   * - catches new students
   * - catches payments
   * - checks fee/membership reminders
   */
  const task = cron.schedule(
    "*/5 * * * *",
    () => {
      runEmailAutomation().catch(error => {
        logger.error(
          `Email scheduler error: ${error.message}`
        );
      });
    },
    {
      timezone: "Asia/Kolkata"
    }
  );

  logger.info("Email automation scheduler started.");
  return task;
}

module.exports = {
  startEmailScheduler,
  runEmailAutomation
};
