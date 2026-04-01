const logger = require('../config/logger');

// Fields to redact from audit log details
const SENSITIVE_FIELDS = ['password', 'password_hash', 'token', 'refreshToken', 'authorization'];

const redactObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  const redacted = { ...obj };
  SENSITIVE_FIELDS.forEach((field) => {
    if (redacted[field]) {
      redacted[field] = '[REDACTED]';
    }
  });
  return redacted;
};

/**
 * Audit logging middleware factory.
 * Logs action after response is sent (non-blocking).
 *
 * @param {string} action - Audit action name (e.g., 'USER_LOGIN')
 */
const auditLogger = (action) => {
  return (req, res, next) => {
    // Log after response is finished (non-blocking)
    res.on('finish', () => {
      setImmediate(async () => {
        try {
          const auditService = require('../services/audit.service');
          await auditService.log({
            user_id: req.user ? req.user.user_id : null,
            action,
            resource_type: null,
            resource_id: null,
            details: redactObject(req.body),
            ip_address: req.ip,
            user_agent: req.headers['user-agent'],
            request_id: req.requestId,
            result: res.statusCode < 400 ? 'SUCCESS' : 'FAILURE',
          });
        } catch (err) {
          // Audit logging failures must never crash the request
          logger.error('Audit log write failed:', err.message);
        }
      });
    });

    next();
  };
};

module.exports = auditLogger;
