"use strict";

const env = require("../src/config/env");
const { connectDB, disconnectDB } = require("../src/config/db");
const Owner = require("../src/models/Owner");

async function seedOwner() {
  const { name, loginId, password } = env.seedOwner;

  if (!password) {
    console.error(
      "SEED_OWNER_PASSWORD is not set. Add it to your .env before running `npm run seed:owner`."
    );
    process.exitCode = 1;
    return;
  }

  if (password.length < 8) {
    console.error("SEED_OWNER_PASSWORD must be at least 8 characters long.");
    process.exitCode = 1;
    return;
  }

  await connectDB();

  const existing = await Owner.findOne({ loginId: loginId.toLowerCase() });
  if (existing) {
    console.log(`✔ Owner account already exists for "${loginId}". Nothing to do.`);
    console.log("  (The seed script never overwrites an existing owner's password.)");
    await disconnectDB();
    return;
  }

  const passwordHash = await Owner.hashPassword(password);
  const owner = await Owner.create({ name, loginId: loginId.toLowerCase(), passwordHash });

  console.log("✔ Owner account created successfully.");
  console.log(`  Login ID: ${owner.loginId}`);
  console.log("  Password: (the value you set in SEED_OWNER_PASSWORD - not shown here)");
  console.log("  You can now log in from the frontend's owner portal.");

  await disconnectDB();
}

seedOwner().catch((error) => {
  console.error("Failed to seed owner account:", error.message);
  process.exitCode = 1;
});
