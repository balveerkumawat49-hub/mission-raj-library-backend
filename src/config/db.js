"use strict";

const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

let isConnected = false;

async function connectDB() {
  mongoose.set("strictQuery", true);

  mongoose.connection.on("connected", () => {
    isConnected = true;
    logger.info("MongoDB connected");
  });

  mongoose.connection.on("error", (error) => {
    isConnected = false;
    logger.error(`MongoDB connection error: ${error.message}`);
  });

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("MongoDB disconnected");
  });

  await mongoose.connect(env.databaseUrl, {
    serverSelectionTimeoutMS: 10000
  });

  return mongoose.connection;
}

function isDbConnected() {
  // 1 === connected, per mongoose.ConnectionStates
  return mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  await mongoose.disconnect();
  isConnected = false;
}

module.exports = { connectDB, disconnectDB, isDbConnected };
