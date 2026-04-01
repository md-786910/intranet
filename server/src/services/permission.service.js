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

      const [result] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM user_role_assignment ura
          JOIN role_permission rp
            ON rp.role_id = ura.role_id
           AND rp.effect = 'ALLOW'
          JOIN module_action ma
            ON ma.module_action_id = rp.module_action_id
           AND ma.action_code = :actionCode
          JOIN module m
            ON m.module_id = ma.module_id
           AND m.code = :moduleCode
          WHERE ura.user_id = :userId
            AND (${conditions.join(' OR ')})
            AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
            AND (ura.ends_at IS NULL OR ura.ends_at > NOW())
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

      const permissions = await sequelize.query(`
        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_role_assignment ura
        JOIN role_permission rp
          ON rp.role_id = ura.role_id
         AND rp.effect = 'ALLOW'
        JOIN module_action ma
          ON ma.module_action_id = rp.module_action_id
        JOIN module m
          ON m.module_id = ma.module_id
        WHERE ura.user_id = :userId
          AND (${conditions.join(' OR ')})
          AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
          AND (ura.ends_at IS NULL OR ura.ends_at > NOW())
        ORDER BY m.code, ma.action_code
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
   * Invalidate all permission caches for a user.
   */
  async invalidateUserCache(userId) {
    await cacheService.deletePattern(`perm:${userId}:*`);
    await cacheService.deletePattern(`perms:${userId}:*`);
  },
};

module.exports = permissionService;
