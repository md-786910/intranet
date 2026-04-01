const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");
const { DEFAULT_ORG_UNIT_ID } = require("../utils/constants");

/**
 * Dynamic RBAC authorization middleware factory.
 * Checks if user has the specified module:action permission at the given scope.
 *
 * Scope resolution order:
 *   body.owning_org_unit_id → body.org_unit_id → params.orgUnitId → query.org_unit_id
 * Falls back to DEFAULT_ORG_UNIT_ID for read-only (GET) requests when no scope is provided.
 *
 * Usage: router.post('/news', authenticate, authorize('NEWS', 'CREATE'), handler)
 */
const authorize = (moduleCode, actionCode) => {
  return async (req, res, next) => {
    try {
      // Extract scope from request
      let orgUnitId =
        req.body.owning_org_unit_id ||
        req.body.org_unit_id ||
        req.params.orgUnitId ||
        req.query.org_unit_id;

      // Fall back to default org unit scope when not provided
      if (!orgUnitId) {
        orgUnitId = DEFAULT_ORG_UNIT_ID;
      }

      // Import dynamically to avoid circular dependency
      const permissionService = require("../services/permission.service");
      const hasPermission = await permissionService.checkPermission(
        req.user.user_id,
        moduleCode,
        actionCode,
        orgUnitId,
      );

      if (!hasPermission) {
        logger.warn(
          `Permission denied: user=${req.user.user_id} action=${moduleCode}:${actionCode} scope=${orgUnitId}`,
        );

        throw ApiError.forbidden(
          `Insufficient permission: ${moduleCode}:${actionCode}`,
        );
      }

      req.authorizedScope = orgUnitId;
      next();
    } catch (error) {
      next(error);
    }
  };
};

module.exports = authorize;
