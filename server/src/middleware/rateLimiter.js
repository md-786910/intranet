const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { getRedisClient } = require('../config/redis');

/**
 * Global rate limiter: 100 req / 15min per IP.
 * Redis-backed for persistence across restarts and distributed deployments.
 */
const globalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:global:',
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    status: 'fail',
    message: 'Too many requests, please try again later',
  },
});

/**
 * Auth rate limiter: 5 req / 15min per IP on login/refresh.
 * Prevents brute-force attacks.
 */
const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args) => getRedisClient().call(...args),
    prefix: 'rl:auth:',
  }),
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX, 10) || 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip,
  message: {
    status: 'fail',
    message: 'Too many authentication attempts, please try again later',
  },
});

module.exports = { globalLimiter, authLimiter };
