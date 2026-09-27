"use strict";

const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, ".mongo-memory-config.json");

module.exports = async function globalTeardown() {
  if (global.__MONGOINSTANCE) {
    await global.__MONGOINSTANCE.stop();
  }
  if (fs.existsSync(CONFIG_PATH)) {
    fs.unlinkSync(CONFIG_PATH);
  }
};
