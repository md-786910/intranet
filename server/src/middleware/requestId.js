const { v4: uuidv4 } = require('uuid');

/**
 * Attach a unique request ID to every request for tracing.
 * Uses client-provided X-Request-Id header or generates a new UUID.
 */
const requestId = (req, res, next) => {
  req.requestId = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-Id', req.requestId);
  next();
};

module.exports = requestId;
