require("./config/env");

const app = require("./app");
const { sequelize } = require("./database/models");
const { createRedisClient } = require("./config/redis");
const logger = require("./config/logger");

const PORT = process.env.PORT || 8000;

const start = async () => {
  // Log resolved DB config for debugging (no secrets)
  logger.info(
    `DB config: host=${process.env.DB_HOST} port=${process.env.DB_PORT} db=${process.env.DB_NAME} user=${process.env.DB_USER}`,
  );

  // Verify database connection
  try {
    await sequelize.authenticate();
    logger.info("PostgreSQL connected successfully");
  } catch (err) {
    logger.error(`PostgreSQL connection failed: ${err.message}`);
    process.exit(1);
  }

  // Verify Redis connection
  try {
    const redis = createRedisClient();
    await redis.ping();
    logger.info("Redis connected successfully");
  } catch (err) {
    logger.error(`Redis connection failed: ${err.message}`);
    process.exit(1);
  }

  // Start HTTP server
  const server = app.listen(PORT, "0.0.0.0", () => {
    logger.info(
      `Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`,
    );
  });

  // Graceful shutdown
  const shutdown = async (signal) => {
    logger.info(`${signal} received. Shutting down gracefully...`);

    server.close(async () => {
      try {
        await sequelize.close();
        logger.info("PostgreSQL connection closed");

        const { getRedisClient } = require("./config/redis");
        const redis = getRedisClient();
        await redis.quit();
        logger.info("Redis connection closed");
      } catch (err) {
        logger.error("Error during shutdown:", err.message);
      }

      logger.info("Server closed");
      process.exit(0);
    });

    // Force exit after 10 seconds
    setTimeout(() => {
      logger.error("Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // Handle unhandled rejections
  process.on("unhandledRejection", (err) => {
    logger.error("Unhandled rejection:", err);
    shutdown("UNHANDLED_REJECTION");
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception:", err);
    shutdown("UNCAUGHT_EXCEPTION");
  });
};

start().catch((err) => {
  logger.error("Failed to start server:", err);
  process.exit(1);
});
