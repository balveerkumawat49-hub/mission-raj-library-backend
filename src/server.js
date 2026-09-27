"use strict";

const app = require("./app");
const env = require("./config/env");
const { connectDB } = require("./config/db");
const logger = require("./utils/logger");
const { startEmailScheduler } = require("./services/email.scheduler");

let server;

async function start() {
  try {
    await connectDB();
    logger.info(`Database connected: ${env.databaseUrl.replace(/\/\/.*@/, "//***@")}`);

    server = app.listen(env.port, () => {
      logger.info(`Library backend listening on port ${env.port} [${env.nodeEnv}]`);
      startEmailScheduler();
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`);
    process.exit(1);
  }
}

function shutdown(signal) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      logger.info("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled promise rejection: ${reason}`);
});
process.on("uncaughtException", (error) => {
  logger.error(`Uncaught exception: ${error.message}`, { stack: error.stack });
  process.exit(1);
});

start();

module.exports = app;
