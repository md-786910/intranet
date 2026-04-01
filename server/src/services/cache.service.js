const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

const cacheService = {
  /**
   * Get a value from Redis cache.
   * @returns {string|null} Cached value or null
   */
  async get(key) {
    try {
      const redis = getRedisClient();
      return await redis.get(key);
    } catch (err) {
      logger.error('Cache get error:', err.message);
      return null;
    }
  },

  /**
   * Set a value in Redis cache with optional TTL.
   * @param {string} key
   * @param {string} value
   * @param {number} [ttlSeconds] - Time to live in seconds
   */
  async set(key, value, ttlSeconds) {
    try {
      const redis = getRedisClient();
      if (ttlSeconds) {
        await redis.set(key, value, 'EX', ttlSeconds);
      } else {
        await redis.set(key, value);
      }
    } catch (err) {
      logger.error('Cache set error:', err.message);
    }
  },

  /**
   * Delete a specific key from cache.
   */
  async del(key) {
    try {
      const redis = getRedisClient();
      await redis.del(key);
    } catch (err) {
      logger.error('Cache del error:', err.message);
    }
  },

  /**
   * Delete all keys matching a pattern.
   * Uses SCAN to avoid blocking Redis.
   * Note: ioredis key prefix is applied automatically.
   */
  async deletePattern(pattern) {
    try {
      const redis = getRedisClient();
      let cursor = '0';
      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100
        );
        cursor = nextCursor;
        if (keys.length > 0) {
          // Keys from SCAN already include the prefix, so use unlink directly
          const pipeline = redis.pipeline();
          keys.forEach((key) => {
            // Strip the prefix that ioredis adds since del/unlink will re-add it
            const unprefixed = key.replace(/^bh:/, '');
            pipeline.del(unprefixed);
          });
          await pipeline.exec();
        }
      } while (cursor !== '0');
    } catch (err) {
      logger.error('Cache deletePattern error:', err.message);
    }
  },
};

module.exports = cacheService;
