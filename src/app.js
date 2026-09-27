"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoSanitize = require("express-mongo-sanitize");
const hpp = require("hpp");

const env = require("./config/env");
const logger = require("./utils/logger");
const ApiError = require("./utils/ApiError");
const { isDbConnected } = require("./config/db");
const { generalLimiter } = require("./middleware/rateLimiter");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const apiRoutes = require("./routes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(helmet());
app.use(compression());

app.use(
  cors({
    origin(origin, callback) {
      // Allow non-browser tools (curl, server-to-server) with no Origin
      // header, and any origin explicitly listed in CORS_ORIGINS. The
      // frontend is frequently opened straight from disk, which sends
      // Origin: null - include "null" in CORS_ORIGINS to allow that.
      if (!origin || env.corsOrigins.includes(origin) || env.corsOrigins.includes("*")) {
        return callback(null, true);
      }
      callback(ApiError.forbidden(`Origin ${origin} is not allowed by CORS policy.`, "CORS_FORBIDDEN"));
    },
    credentials: true
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use(mongoSanitize());
app.use(hpp());

if (env.nodeEnv !== "test") {
  app.use(
    morgan(env.nodeEnv === "development" ? "dev" : "combined", {
      stream: { write: (message) => logger.info(message.trim()) }
    })
  );
}

app.use("/api", generalLimiter);

app.get("/health", (_req, res) => {
  const dbConnected = isDbConnected();
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    message: dbConnected ? "Library backend is running" : "Library backend is running but the database is disconnected"
  });
});

app.use("/api", apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
