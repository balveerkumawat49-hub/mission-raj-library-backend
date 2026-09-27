"use strict";

require("dotenv").config();
const mongoose = require("mongoose");

const Learner = require("./src/models/Learner");
const Payment = require("./src/models/Payment");
const Attendance = require("./src/models/Attendance");
const SeatAllocation = require("./src/models/SeatAllocation");
const Notification = require("./src/models/Notification");
const RefreshToken = require("./src/models/RefreshToken");

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("MONGODB_URI not found in .env");
  }

  await mongoose.connect(process.env.DATABASE_URL);

  console.log("\n========================================");
  console.log("   LIBRARY MISSION - SAFE CLEANUP");
  console.log("========================================\n");

  const counts = {
    learners: await Learner.countDocuments(),
    payments: await Payment.countDocuments(),
    attendance: await Attendance.countDocuments(),
    allocations: await SeatAllocation.countDocuments(),
    notifications: await Notification.countDocuments(),
    refreshTokens: await RefreshToken.countDocuments()
  };

  console.log("Current data:");
  console.table(counts);

  console.log("\nNOT TOUCHED:");
  console.log("✅ Owner account");
  console.log("✅ Seats");
  console.log("✅ Membership Plans");
  console.log("✅ Settings");
  console.log("✅ Application code");

  console.log("\nData that WILL be removed:");
  console.log("❌ Students");
  console.log("❌ Student payments");
  console.log("❌ Attendance records");
  console.log("❌ Seat allocations");
  console.log("❌ Notifications");
  console.log("❌ Student/old refresh tokens");

  // Safety requirement:
  // Never run against an obviously non-library/test database.
  const dbName = mongoose.connection.name || "";
  console.log(`\nConnected database: ${dbName}`);

  if (!dbName || dbName === "admin" || dbName === "local" || dbName === "config") {
    throw new Error("Unsafe database name. Cleanup stopped.");
  }

  console.log("\nStarting cleanup...\n");

  const result = {};

  result.seatAllocations = await SeatAllocation.deleteMany({});
  result.attendance = await Attendance.deleteMany({});
  result.payments = await Payment.deleteMany({});
  result.notifications = await Notification.deleteMany({});
  result.refreshTokens = await RefreshToken.deleteMany({});
  result.learners = await Learner.deleteMany({});

  console.log("Cleanup completed:");
  console.table({
    seatAllocations: result.seatAllocations.deletedCount,
    attendance: result.attendance.deletedCount,
    payments: result.payments.deletedCount,
    notifications: result.notifications.deletedCount,
    refreshTokens: result.refreshTokens.deletedCount,
    learners: result.learners.deletedCount
  });

  console.log("\n========================================");
  console.log("        CLEANUP SUCCESSFUL");
  console.log("========================================");
  console.log("Owner      : KEPT");
  console.log("Seats      : KEPT");
  console.log("Plans      : KEPT");
  console.log("Settings   : KEPT");
  console.log("Code       : UNTOUCHED");
  console.log("========================================\n");

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n❌ CLEANUP STOPPED");
  console.error(err.message);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
