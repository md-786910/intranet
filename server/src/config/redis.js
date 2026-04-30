const Redis = require("ioredis");
const logger = require("./logger");

let client = null;

const createRedisClient = () => {
  if (client) return client;

  client = new Redis({
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_PASSWORD,
    keyPrefix: "bh:",
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 200, 5000);
      return delay;
    },
    reconnectOnError(err) {
      const targetError = "READONLY";
      if (err.message.includes(targetError)) {
        return true;
      }
      return false;
    },
  });

  client.on("connect", () => {
    logger.info("Redis connected");
  });

  client.on("error", (err) => {
    logger.error("Redis error:", err);
  });

  client.on("close", () => {
    logger.warn("Redis connection closed");
  });

  return client;
};

const getRedisClient = () => {
  if (!client) {
    return createRedisClient();
  }
  return client;
};

module.exports = { createRedisClient, getRedisClient };
