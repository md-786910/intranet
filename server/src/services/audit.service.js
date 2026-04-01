const logger = require('../config/logger');

const auditService = {
  /**
   * Write an audit log entry.
   * Non-blocking — failures are logged but never thrown.
   */
  async log(entry) {
    try {
      const { AuditLog } = require('../database/models');
      await AuditLog.create({
        user_id: entry.user_id || null,
        action: entry.action,
        resource_type: entry.resource_type || null,
        resource_id: entry.resource_id || null,
        details: entry.details || null,
        ip_address: entry.ip_address || null,
        user_agent: entry.user_agent || null,
        request_id: entry.request_id || null,
        result: entry.result || null,
      });
    } catch (err) {
      // Audit failures must never crash the application
      logger.error('Failed to write audit log:', err.message);
    }
  },
};

module.exports = auditService;
