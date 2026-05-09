const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Socket.IO authentication middleware.
 * Verifies JWT from handshake auth.token, checks Redis blacklist,
 * and attaches user info to socket.user.
 */
const socketAuth = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      logger.debug('Socket auth failed: no token provided');
      return next(new Error('Authentication required'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        logger.debug('Socket auth failed: token expired');
      } else {
        logger.debug(`Socket auth failed: ${err.message}`);
      }
      return next(new Error('Authentication required'));
    }

    // Check Redis blacklist (revoked access tokens)
    if (decoded.jti) {
      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`bl:${decoded.jti}`);
      if (isBlacklisted) {
        logger.debug(`Socket auth failed: token ${decoded.jti} is blacklisted`);
        return next(new Error('Authentication required'));
      }
    }

    // Attach user info to socket
    socket.user = {
      user_id: decoded.userId,
      email: decoded.email,
      jti: decoded.jti,
    };

    next();
  } catch (error) {
    logger.error('Unexpected socket auth error:', error);
    next(new Error('Authentication failed'));
  }
};

module.exports = socketAuth;
