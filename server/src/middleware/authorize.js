const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");
const { DEFAULT_ORGANISATION_ID } = require("../utils/constants");

/**
 * Dynamic RBAC authorization middleware factory.
 * Checks if user has the specified module:action permission at the given scope.
 *
 * Scope resolution order:
 *   body.owning_scope_type/id → body.scope_type/id → query.scope_type/id
 * Falls back to ORGANISATION scope for read-only (GET) requests when no scope is provided.
 *
 * Usage: router.post('/news', authenticate, authorize('NEWS', 'CREATE'), handler)
 */
const authorize = (moduleCode, actionCode) => {
  return async (req, res, next) => {
    try {
      // Extract scope from request
      let scopeType =
        req.body.owning_scope_type ||
        req.body.scope_type ||
        req.query.scope_type;

      let scopeId =
        req.body.owning_scope_id ||
        req.body.scope_id ||
        req.query.scope_id;

      // Fall back to default organisation scope when not provided
      if (!scopeType || !scopeId) {
        scopeType = 'ORGANISATION';
        scopeId = DEFAULT_ORGANISATION_ID;
      }

      // Import dynamically to avoid circular dependency
      const permissionService = require("../services/permission.service");
      const hasPermission = await permissionService.checkPermission(
        req.user.user_id,
        moduleCode,
        actionCode,
        scopeType,
        parseInt(scopeId, 10),
      );

      if (!hasPermission) {
        logger.warn(
          `Permission denied: user=${req.user.user_id} action=${moduleCode}:${actionCode} scope=${scopeType}:${scopeId}`,
        );

        throw ApiError.forbidden(
          `Insufficient permission: ${moduleCode}:${actionCode}`,
        );
      }

      req.authorizedScope = { scopeType, scopeId: parseInt(scopeId, 10) };
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorize;
