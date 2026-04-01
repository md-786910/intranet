const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * JWT authentication middleware.
 * Extracts Bearer token, verifies signature + expiry,
 * checks Redis blacklist, attaches req.user.
 *
 * Security: generic 401 on any failure (no info leakage).
 * Specific reason logged server-side.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.debug('Auth failed: no Bearer token provided');
      throw ApiError.unauthorized('Authentication required');
    }

    const token = authHeader.split(' ')[1];

    // Verify JWT signature and expiration
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.debug('Auth failed: token expired');
      } else if (err.name === 'JsonWebTokenError') {
        logger.debug(`Auth failed: invalid token - ${err.message}`);
      } else {
        logger.debug(`Auth failed: ${err.message}`);
      }
      throw ApiError.unauthorized('Authentication required');
    }

    // Check Redis blacklist (revoked access tokens)
    if (decoded.jti) {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`bl:${decoded.jti}`);
      if (isBlacklisted) {
        logger.debug(`Auth failed: token ${decoded.jti} is blacklisted`);
        throw ApiError.unauthorized('Authentication required');
      }
    }

    // Attach user info to request
    req.user = {
      user_id: decoded.userId,
      email: decoded.email,
      jti: decoded.jti,
    };

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      return next(error);
    }
    logger.error('Unexpected auth error:', error);
    next(ApiError.unauthorized('Authentication required'));
  }
};

module.exports = authenticate;
