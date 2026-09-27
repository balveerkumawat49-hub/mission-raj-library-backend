"use strict";

const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");

const CONFIG_PATH = path.join(__dirname, ".mongo-memory-config.json");

function readMemoryUri() {
  const { uri } = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  return uri;
}

async function connectTestDB() {
  if (mongoose.connection.readyState === 1) return;
  const uri = readMemoryUri();
  await mongoose.connect(uri);
}

async function clearTestDB() {
  const collections = mongoose.connection.collections;
  await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
}

async function disconnectTestDB() {
  await mongoose.disconnect();
}

module.exports = { connectTestDB, clearTestDB, disconnectTestDB };
