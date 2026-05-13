const { QueryTypes } = require('sequelize');
const cacheService = require('./cache.service');
const scopeService = require('./scope.service');
const logger = require('../config/logger');

const CACHE_TTL = 300; // 5 minutes

const permissionService = {
  /**
   * Check if user can perform action on module at the given scope.
   * Walks the 4-level hierarchy chain instead of using a closure table.
   */
  async checkPermission(userId, moduleCode, actionCode, scopeType, scopeId) {
    const cacheKey = `perm:${userId}:${moduleCode}:${actionCode}:${scopeType}:${scopeId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) return cached === 'true';

    try {
      const { sequelize } = require('../database/models');

      // Resolve the target scope's full ancestor chain
      const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
      if (!ancestors) {
        await cacheService.set(cacheKey, 'false', CACHE_TTL);
        return false;
      }

      // Build conditions to match any ancestor level
      const conditions = [];
      const replacements = { userId, moduleCode, actionCode };

      if (ancestors.organisation_id != null) {
        conditions.push(`(ura.scope_type = 'ORGANISATION' AND ura.scope_id = :orgId)`);
        replacements.orgId = ancestors.organisation_id;
      }
      if (ancestors.office_location_id != null) {
        conditions.push(`(ura.scope_type = 'OFFICE_LOCATION' AND ura.scope_id = :officeId)`);
        replacements.officeId = ancestors.office_location_id;
      }
      if (ancestors.vertical_id != null) {
        conditions.push(`(ura.scope_type = 'VERTICAL' AND ura.scope_id = :verticalId)`);
        replacements.verticalId = ancestors.vertical_id;
      }
      if (ancestors.department_id != null) {
        conditions.push(`(ura.scope_type = 'DEPARTMENT' AND ura.scope_id = :deptId)`);
        replacements.deptId = ancestors.department_id;
      }

      if (conditions.length === 0) {
        await cacheService.set(cacheKey, 'false', CACHE_TTL);
        return false;
      }

      // Build direct permission scope conditions (same ancestor chain)
      const directConditions = [];
      if (ancestors.organisation_id != null) {
        directConditions.push(`(up.scope_type = 'ORGANISATION' AND up.scope_id = :orgId)`);
      }
      if (ancestors.office_location_id != null) {
        directConditions.push(`(up.scope_type = 'OFFICE_LOCATION' AND up.scope_id = :officeId)`);
      }
      if (ancestors.vertical_id != null) {
        directConditions.push(`(up.scope_type = 'VERTICAL' AND up.scope_id = :verticalId)`);
      }
      if (ancestors.department_id != null) {
        directConditions.push(`(up.scope_type = 'DEPARTMENT' AND up.scope_id = :deptId)`);
      }

      const [result] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM user_role_assignment ura
          JOIN role_permission rp ON rp.role_id = ura.role_id AND rp.effect = 'ALLOW'
          JOIN module_action ma ON ma.module_action_id = rp.module_action_id AND ma.action_code = :actionCode
          JOIN module m ON m.module_id = ma.module_id AND m.code = :moduleCode
          WHERE ura.user_id = :userId
            AND (${conditions.join(' OR ')})
            AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
            AND (ura.ends_at IS NULL OR ura.ends_at > NOW())

          UNION ALL

          SELECT 1
          FROM user_permission up
          JOIN module_action ma ON ma.module_action_id = up.module_action_id AND ma.action_code = :actionCode
          JOIN module m ON m.module_id = ma.module_id AND m.code = :moduleCode
          WHERE up.user_id = :userId
            AND up.effect = 'ALLOW'
            ${directConditions.length > 0 ? `AND (${directConditions.join(' OR ')})` : ''}
        ) AS has_permission
      `, {
        replacements,
        type: QueryTypes.SELECT,
      });

      const allowed = result.has_permission;
      await cacheService.set(cacheKey, String(allowed), CACHE_TTL);
      return allowed;
    } catch (err) {
      logger.error('Permission check error:', err.message);
      return false; // Fail closed: deny on error
    }
  },

  /**
   * Get ALL effective permissions for a user at a specific scope.
   * Returns { MODULE_CODE: ['ACTION1', 'ACTION2'], ... }
   */
  async getEffectivePermissions(userId, scopeType, scopeId) {
    const cacheKey = `perms:${userId}:${scopeType}:${scopeId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const { sequelize } = require('../database/models');

      const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
      if (!ancestors) return {};

      const conditions = [];
      const replacements = { userId };

      if (ancestors.organisation_id != null) {
        conditions.push(`(ura.scope_type = 'ORGANISATION' AND ura.scope_id = :orgId)`);
        replacements.orgId = ancestors.organisation_id;
      }
      if (ancestors.office_location_id != null) {
        conditions.push(`(ura.scope_type = 'OFFICE_LOCATION' AND ura.scope_id = :officeId)`);
        replacements.officeId = ancestors.office_location_id;
      }
      if (ancestors.vertical_id != null) {
        conditions.push(`(ura.scope_type = 'VERTICAL' AND ura.scope_id = :verticalId)`);
        replacements.verticalId = ancestors.vertical_id;
      }
      if (ancestors.department_id != null) {
        conditions.push(`(ura.scope_type = 'DEPARTMENT' AND ura.scope_id = :deptId)`);
        replacements.deptId = ancestors.department_id;
      }

      if (conditions.length === 0) return {};

      // Build direct permission scope conditions
      const directConditions = [];
      if (ancestors.organisation_id != null) {
        directConditions.push(`(up.scope_type = 'ORGANISATION' AND up.scope_id = :orgId)`);
      }
      if (ancestors.office_location_id != null) {
        directConditions.push(`(up.scope_type = 'OFFICE_LOCATION' AND up.scope_id = :officeId)`);
      }
      if (ancestors.vertical_id != null) {
        directConditions.push(`(up.scope_type = 'VERTICAL' AND up.scope_id = :verticalId)`);
      }
      if (ancestors.department_id != null) {
        directConditions.push(`(up.scope_type = 'DEPARTMENT' AND up.scope_id = :deptId)`);
      }

      const permissions = await sequelize.query(`
        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_role_assignment ura
        JOIN role_permission rp ON rp.role_id = ura.role_id AND rp.effect = 'ALLOW'
        JOIN module_action ma ON ma.module_action_id = rp.module_action_id
        JOIN module m ON m.module_id = ma.module_id
        WHERE ura.user_id = :userId
          AND (${conditions.join(' OR ')})
          AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
          AND (ura.ends_at IS NULL OR ura.ends_at > NOW())

        UNION

        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_permission up
        JOIN module_action ma ON ma.module_action_id = up.module_action_id
        JOIN module m ON m.module_id = ma.module_id
        WHERE up.user_id = :userId
          AND up.effect = 'ALLOW'
          ${directConditions.length > 0 ? `AND (${directConditions.join(' OR ')})` : ''}

        ORDER BY module, action
      `, {
        replacements,
        type: QueryTypes.SELECT,
      });

      const permMap = {};
      permissions.forEach(({ module, action }) => {
        if (!permMap[module]) permMap[module] = [];
        permMap[module].push(action);
      });

      await cacheService.set(cacheKey, JSON.stringify(permMap), CACHE_TTL);
      return permMap;
    } catch (err) {
      logger.error('Get effective permissions error:', err.message);
      return {};
    }
  },

  /**
   * Get the union of all granted permissions for a user across every assigned scope.
   * Used for navigation/bootstrap so scoped assignments still expose the correct menus.
   */
  async getAllGrantedPermissions(userId) {
    const cacheKey = `perms:${userId}:ALL`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const { sequelize } = require('../database/models');

      const permissions = await sequelize.query(`
        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_role_assignment ura
        JOIN role_permission rp ON rp.role_id = ura.role_id AND rp.effect = 'ALLOW'
        JOIN module_action ma ON ma.module_action_id = rp.module_action_id
        JOIN module m ON m.module_id = ma.module_id
        WHERE ura.user_id = :userId
          AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
          AND (ura.ends_at IS NULL OR ura.ends_at > NOW())

        UNION

        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_permission up
        JOIN module_action ma ON ma.module_action_id = up.module_action_id
        JOIN module m ON m.module_id = ma.module_id
        WHERE up.user_id = :userId
          AND up.effect = 'ALLOW'

        ORDER BY module, action
      `, {
        replacements: { userId },
        type: QueryTypes.SELECT,
      });

      const permMap = {};
      permissions.forEach(({ module, action }) => {
        if (!permMap[module]) permMap[module] = [];
        permMap[module].push(action);
      });

      await cacheService.set(cacheKey, JSON.stringify(permMap), CACHE_TTL);
      return permMap;
    } catch (err) {
      logger.error('Get all granted permissions error:', err.message);
      return {};
    }
  },

  /**
   * Check whether a user has a permission at any assigned scope.
   * Used for read/navigation endpoints that do not carry a concrete scope.
   */
  async hasPermissionAnywhere(userId, moduleCode, actionCode) {
    const cacheKey = `perm:${userId}:${moduleCode}:${actionCode}:ANY`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) return cached === 'true';

    try {
      const permissions = await this.getAllGrantedPermissions(userId);
      const allowed = Array.isArray(permissions[moduleCode]) && permissions[moduleCode].includes(actionCode);
      await cacheService.set(cacheKey, String(allowed), CACHE_TTL);
      return allowed;
    } catch (err) {
      logger.error('Has permission anywhere error:', err.message);
      return false;
    }
  },

  /**
   * Hierarchy-aware admin management fallback.
   * Office managers can manage the full subtree beneath their office.
   * Vertical managers can manage departments beneath their vertical.
   */
  async checkAdminHierarchyPermission(userId, actionCode, scopeType, scopeId) {
    if (!scopeType || !scopeId) return false;

    try {
      const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
      if (!ancestors) return false;

      if (actionCode === 'MANAGE_VERTICALS') {
        if (!ancestors.office_location_id) return false;
        return this.checkPermission(
          userId,
          'ADMIN',
          'MANAGE_OFFICE_LOCATIONS',
          'OFFICE_LOCATION',
          ancestors.office_location_id,
        );
      }

      if (actionCode === 'MANAGE_DEPARTMENTS') {
        if (ancestors.vertical_id) {
          const canManageVertical = await this.checkPermission(
            userId,
            'ADMIN',
            'MANAGE_VERTICALS',
            'VERTICAL',
            ancestors.vertical_id,
          );

          if (canManageVertical) return true;
        }

        if (ancestors.office_location_id) {
          return this.checkPermission(
            userId,
            'ADMIN',
            'MANAGE_OFFICE_LOCATIONS',
            'OFFICE_LOCATION',
            ancestors.office_location_id,
          );
        }
      }

      return false;
    } catch (err) {
      logger.error('Admin hierarchy permission check error:', err.message);
      return false;
    }
  },

  /**
   * Returns true if the user effectively manages a module organisation-wide:
   * they hold the OWNER role, OR they have an ORGANISATION-scope role
   * assignment whose role grants any of the module's manage-tier actions
   * (CREATE / EDIT / PUBLISH / DELETE).
   *
   * Used by list endpoints to decide between "show everything" (global) and
   * "show only your own" (scoped) admin views.
   */
  async isGlobalManager(userId, moduleCode) {
    const cacheKey = `perm:${userId}:${moduleCode}:GLOBAL_MANAGER`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) return cached === 'true';

    try {
      const { sequelize } = require('../database/models');

      const [row] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM user_role_assignment ura
          JOIN role r ON r.role_id = ura.role_id
          LEFT JOIN role_permission rp ON rp.role_id = ura.role_id AND rp.effect = 'ALLOW'
          LEFT JOIN module_action ma ON ma.module_action_id = rp.module_action_id
            AND ma.action_code IN ('CREATE','EDIT','PUBLISH','DELETE')
          LEFT JOIN module m ON m.module_id = ma.module_id AND m.code = :moduleCode
          WHERE ura.user_id = :userId
            AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
            AND (ura.ends_at IS NULL OR ura.ends_at > NOW())
            AND (
              r.code = 'OWNER'
              OR (ura.scope_type = 'ORGANISATION' AND m.module_id IS NOT NULL)
            )
        ) AS is_global
      `, {
        replacements: { userId, moduleCode },
        type: QueryTypes.SELECT,
      });

      const allowed = Boolean(row?.is_global);
      await cacheService.set(cacheKey, String(allowed), CACHE_TTL);
      return allowed;
    } catch (err) {
      logger.error('isGlobalManager check error:', err.message);
      return false;
    }
  },

  /**
   * Invalidate all permission caches for a user.
   */
  async invalidateUserCache(userId) {
    await cacheService.deletePattern(`perm:${userId}:*`);
    await cacheService.deletePattern(`perms:${userId}:*`);
  },
};

module.exports = permissionService;
