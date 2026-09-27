"use strict";

const { MongoMemoryServer } = require("mongodb-memory-server");
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, ".mongo-memory-config.json");

module.exports = async function globalSetup() {
  const instance = await MongoMemoryServer.create();
  const uri = instance.getUri();

  // globalSetup runs in its own process, so the URI is handed to test
  // workers via a small config file rather than process.env (which does
  // not propagate across Jest's process boundary).
  global.__MONGOINSTANCE = instance;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify({ uri }));

  // Note: globalSetup runs in a separate process from the test workers,
  // so process.env changes made here do NOT propagate to test files.
  // The URI is read back out of CONFIG_PATH by tests/testUtils.js instead.
  // JWT secrets fall back automatically in src/config/env.js when
  // NODE_ENV=test (set via `cross-env NODE_ENV=test` in package.json).
};
