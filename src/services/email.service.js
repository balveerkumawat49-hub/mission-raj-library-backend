"use strict";

const env = require("../config/env");

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function money(value) {
  return `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function isConfigured() {
  return Boolean(env.brevoApiKey && env.brevoSenderEmail);
}

async function sendEmail({
  to,
  toName = "",
  subject,
  html,
  text = ""
}) {
  if (!to || !String(to).trim()) {
    return { skipped: true, reason: "missing-recipient" };
  }

  if (!isConfigured()) {
    return { skipped: true, reason: "email-not-configured" };
  }

  const payload = {
    sender: {
      name: env.brevoSenderName || "Mission Library",
      email: env.brevoSenderEmail
    },
    to: [{
      email: String(to).trim(),
      name: String(toName || "Member").trim()
    }],
    subject,
    htmlContent: html
  };

  if (text) payload.textContent = text;

  const headers = {
    accept: "application/json",
    "api-key": env.brevoApiKey,
    "content-type": "application/json"
  };

  if (env.emailSandbox) {
    headers["X-Sib-Sandbox"] = "drop";
  }

  const response = await fetch(
    "https://api.brevo.com/v3/smtp/email",
    {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    }
  );

  const bodyText = await response.text();

  let body = {};
  try {
    body = bodyText ? JSON.parse(bodyText) : {};
  } catch (_) {
    body = { raw: bodyText };
  }

  if (!response.ok) {
    const error = new Error(
      body?.message ||
      body?.error ||
      `Brevo email failed with HTTP ${response.status}`
    );

    error.status = response.status;
    error.response = body;
    throw error;
  }

  return {
    skipped: false,
    messageId: body?.messageId || ""
  };
}

function layout(title, subtitle, content) {
  return `
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
</head>

<body style="margin:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <div style="padding:32px 12px;">
    <div style="max-width:650px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #e2e8f0;box-shadow:0 8px 30px rgba(15,23,42,.08);">

      <div style="padding:28px 30px;background:#111827;color:#ffffff;">
        <div style="font-size:13px;letter-spacing:1.5px;font-weight:700;opacity:.8;">
          MISSION LIBRARY
        </div>

        <div style="font-size:26px;font-weight:700;margin-top:8px;">
          ${escapeHtml(title)}
        </div>

        <div style="font-size:14px;margin-top:7px;color:#d1d5db;">
          ${escapeHtml(subtitle)}
        </div>
      </div>

      <div style="padding:30px;">
        ${content}
      </div>

      <div style="padding:22px 30px;background:#f8fafc;border-top:1px solid #e5e7eb;">
        <div style="font-weight:700;color:#111827;">Mission Library</div>
        <div style="font-size:13px;color:#64748b;margin-top:5px;">
          Library Management System
        </div>
        <div style="font-size:12px;color:#94a3b8;margin-top:12px;line-height:1.5;">
          This is an automated email. Please keep this message for your records.
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;
}

function detailTable(rows) {
  return `
<table style="width:100%;border-collapse:collapse;margin:22px 0;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
  ${rows.map(([label, value]) => `
    <tr>
      <td style="padding:12px 14px;border-bottom:1px solid #eef2f7;color:#64748b;font-size:13px;width:42%;">
        ${escapeHtml(label)}
      </td>
      <td style="padding:12px 14px;border-bottom:1px solid #eef2f7;font-weight:600;color:#111827;">
        ${value}
      </td>
    </tr>
  `).join("")}
</table>`;
}

async function sendStudentCreatedEmail(student) {
  const name = escapeHtml(student.name || "Member");
  const studentId = escapeHtml(student.studentId || "—");
  const plan = escapeHtml(
    student.membership?.planName || "Library Membership"
  );

  const start = formatDate(student.membership?.startDate);
  const end = formatDate(student.membership?.endDate);

  const total = Number(student.totalFee || 0);
  const paid = Number(student.paidFee || 0);
  const pending = Math.max(0, total - paid);

  const html = layout(
    "Membership Confirmed",
    "Your Mission Library membership has been successfully registered.",
    `
      <p style="font-size:16px;margin-top:0;">
        Hello <strong>${name}</strong> 👋
      </p>

      <p style="color:#475569;line-height:1.7;">
        Welcome to <strong>Mission Library</strong>.
        Your membership has been successfully added to our library management system.
      </p>

      <div style="font-size:14px;font-weight:700;color:#111827;margin-top:26px;">
        Membership Details
      </div>

      ${detailTable([
        ["Student ID", escapeHtml(studentId)],
        ["Membership", plan],
        ["Start Date", escapeHtml(start)],
        ["Valid Until", escapeHtml(end)]
      ])}

      <div style="font-size:14px;font-weight:700;color:#111827;margin-top:26px;">
        Fee Summary
      </div>

      ${detailTable([
        ["Total Fee", money(total)],
        ["Paid", money(paid)],
        ["Pending", money(pending)]
      ])}

      <div style="margin-top:24px;padding:16px 18px;background:#f8fafc;border-left:4px solid #111827;border-radius:8px;color:#475569;line-height:1.6;">
        Please keep this email for your membership and payment records.
      </div>

      <p style="margin-bottom:0;color:#475569;">
        Thank you for choosing <strong>Mission Library</strong>.
      </p>
    `
  );

  return sendEmail({
    to: student.email,
    toName: student.name,
    subject: "Mission Library — Membership Confirmed",
    html
  });
}

async function sendPaymentReceivedEmail(student, payment) {
  const name = escapeHtml(student.name || "Member");

  const amount = Number(payment.amount || 0);
  const total = Number(student.totalFee || 0);
  const paid = Number(student.paidFee || 0);
  const pending = Math.max(0, total - paid);

  const html = layout(
    "Payment Received",
    "Your payment has been successfully recorded.",
    `
      <p style="font-size:16px;margin-top:0;">
        Hello <strong>${name}</strong> 👋
      </p>

      <p style="color:#475569;line-height:1.7;">
        We have successfully recorded your payment with Mission Library.
        Please keep this email as your payment confirmation.
      </p>

      <div style="font-size:14px;font-weight:700;color:#111827;margin-top:26px;">
        Payment Details
      </div>

      ${detailTable([
        ["Amount Received", `<strong>${money(amount)}</strong>`],
        ["Payment Mode", escapeHtml(payment.paymentMode || "—")],
        ["Payment Date", escapeHtml(formatDate(payment.paymentDate))],
        ["Purpose", escapeHtml(payment.purpose || "Library Fee")],
        ["Reference", escapeHtml(payment.reference || "—")]
      ])}

      <div style="font-size:14px;font-weight:700;color:#111827;margin-top:26px;">
        Updated Fee Summary
      </div>

      ${detailTable([
        ["Total Fee", money(total)],
        ["Total Paid", money(paid)],
        ["Remaining Fee", money(pending)]
      ])}

      <p style="margin-bottom:0;color:#475569;">
        Thank you for your payment.
      </p>
    `
  );

  return sendEmail({
    to: student.email,
    toName: student.name,
    subject: "Mission Library — Payment Received",
    html
  });
}

async function sendFeeReminderEmail(student, kind) {
  const name = escapeHtml(student.name || "Member");

  const total = Number(student.totalFee || 0);
  const paid = Number(student.paidFee || 0);
  const pending = Math.max(0, total - paid);

  const expired = kind === "overdue";
  const dueDate = formatDate(student.membership?.endDate);

  const title = expired ? "Fee Overdue" : "Fee Due Reminder";

  const message = expired
    ? "Our records show that your pending library fee has passed its current due date."
    : "This is a friendly reminder that your library fee is due.";

  const html = layout(
    title,
    "Mission Library fee status notification.",
    `
      <p style="font-size:16px;margin-top:0;">
        Hello <strong>${name}</strong> 👋
      </p>

      <p style="color:#475569;line-height:1.7;">
        ${escapeHtml(message)}
      </p>

      ${detailTable([
        ["Pending Amount", `<strong>${money(pending)}</strong>`],
        ["Due Date", escapeHtml(dueDate)],
        ["Total Fee", money(total)],
        ["Amount Paid", money(paid)]
      ])}

      <div style="margin-top:22px;padding:16px 18px;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;color:#9a3412;line-height:1.6;">
        Please contact the library owner for payment-related assistance.
      </div>
    `
  );

  return sendEmail({
    to: student.email,
    toName: student.name,
    subject: expired
      ? "Mission Library — Fee Overdue Reminder"
      : "Mission Library — Fee Due Reminder",
    html
  });
}

async function sendMembershipExpiringEmail(student, daysLeft) {
  const name = escapeHtml(student.name || "Member");
  const end = formatDate(student.membership?.endDate);

  const message =
    daysLeft > 0
      ? `Your membership will expire in ${daysLeft} day${daysLeft === 1 ? "" : "s"}.`
      : "Your membership expires today.";

  const html = layout(
    "Membership Expiry Reminder",
    "Please review your current membership validity.",
    `
      <p style="font-size:16px;margin-top:0;">
        Hello <strong>${name}</strong> 👋
      </p>

      <p style="color:#475569;line-height:1.7;">
        ${escapeHtml(message)}
      </p>

      ${detailTable([
        ["Membership", escapeHtml(student.membership?.planName || "Library Membership")],
        ["Expiry Date", escapeHtml(end)],
        ["Reminder", escapeHtml(
          daysLeft > 0
            ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining`
            : "Expires today"
        )]
      ])}

      <div style="margin-top:22px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;color:#475569;line-height:1.6;">
        Please contact the library owner if you want to continue your membership.
      </div>
    `
  );

  return sendEmail({
    to: student.email,
    toName: student.name,
    subject: `Mission Library — Membership ${daysLeft === 0 ? "Expires Today" : "Expiry Reminder"}`,
    html
  });
}

module.exports = {
  isConfigured,
  sendEmail,
  sendStudentCreatedEmail,
  sendPaymentReceivedEmail,
  sendFeeReminderEmail,
  sendMembershipExpiringEmail
};
