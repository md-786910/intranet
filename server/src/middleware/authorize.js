const logger = require("../config/logger");
const ApiError = require("../utils/ApiError");
const organisationContextService = require("../services/organisation-context.service");

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
      const permissionService = require("../services/permission.service");

      // Extract scope from request
      let scopeType =
        req.body.owning_scope_type ||
        req.body.scope_type ||
        req.query.scope_type;

      let scopeId =
        req.body.owning_scope_id ||
        req.body.scope_id ||
        req.query.scope_id;

      const hasExplicitScope = Boolean(scopeType && scopeId);

      // Read endpoints like list pages often have no concrete scope in the request.
      // In that case, allow access if the user has the permission at any assigned scope.
      if (!hasExplicitScope && req.method === 'GET') {
        const hasPermission = await permissionService.hasPermissionAnywhere(
          req.user.user_id,
          moduleCode,
          actionCode,
        );

        if (!hasPermission) {
          logger.warn(
            `Permission denied: user=${req.user.user_id} action=${moduleCode}:${actionCode} scope=ANY`,
          );

          throw ApiError.forbidden(
            `Insufficient permission: ${moduleCode}:${actionCode}`,
          );
        }

        req.authorizedScope = { scopeType: null, scopeId: null };
        return next();
      }

      // Fall back to default organisation scope when not provided
      if (!scopeType || !scopeId) {
        scopeType = 'ORGANISATION';
        scopeId = await organisationContextService.getCurrentOrganisationId();
      }

      const hasPermission = await permissionService.checkPermission(
        req.user.user_id,
        moduleCode,
        actionCode,
        scopeType,
        parseInt(scopeId, 10),
      );

      if (!hasPermission) {
        if (moduleCode === 'ADMIN') {
          const hasAdminHierarchyPermission = await permissionService.checkAdminHierarchyPermission(
            req.user.user_id,
            actionCode,
            scopeType,
            parseInt(scopeId, 10),
          );

          if (hasAdminHierarchyPermission) {
            req.authorizedScope = { scopeType, scopeId: parseInt(scopeId, 10) };
            return next();
          }
        }

        if (req.method === 'GET') {
          const hasPermissionAtAnyScope = await permissionService.hasPermissionAnywhere(
            req.user.user_id,
            moduleCode,
            actionCode,
          );

          if (hasPermissionAtAnyScope) {
            req.authorizedScope = { scopeType: null, scopeId: null };
            return next();
          }
        }

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
