const { QueryTypes } = require('sequelize');
const cacheService = require('./cache.service');
const logger = require('../config/logger');

const CACHE_TTL = 300; // 5 minutes

const permissionService = {
  /**
   * Check if user can perform action on module at scope.
   * Uses closure table for inheritance — single query, no recursion.
   */
  async checkPermission(userId, moduleCode, actionCode, orgUnitId) {
    const cacheKey = `perm:${userId}:${moduleCode}:${actionCode}:${orgUnitId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached !== null) return cached === 'true';

    try {
      const { sequelize } = require('../database/models');

      const [result] = await sequelize.query(`
        SELECT EXISTS (
          SELECT 1
          FROM user_role_assignment ura
          JOIN org_unit_closure oc
            ON oc.ancestor_org_unit_id = ura.org_unit_id
           AND oc.descendant_org_unit_id = :orgUnitId
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
            AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
            AND (ura.ends_at IS NULL OR ura.ends_at > NOW())
        ) AS has_permission
      `, {
        replacements: { userId, moduleCode, actionCode, orgUnitId },
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
  async getEffectivePermissions(userId, orgUnitId) {
    const cacheKey = `perms:${userId}:${orgUnitId}`;
    const cached = await cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    try {
      const { sequelize } = require('../database/models');

      const permissions = await sequelize.query(`
        SELECT DISTINCT m.code AS module, ma.action_code AS action
        FROM user_role_assignment ura
        JOIN org_unit_closure oc
          ON oc.ancestor_org_unit_id = ura.org_unit_id
         AND oc.descendant_org_unit_id = :orgUnitId
        JOIN role_permission rp
          ON rp.role_id = ura.role_id
         AND rp.effect = 'ALLOW'
        JOIN module_action ma
          ON ma.module_action_id = rp.module_action_id
        JOIN module m
          ON m.module_id = ma.module_id
        WHERE ura.user_id = :userId
          AND (ura.starts_at IS NULL OR ura.starts_at <= NOW())
          AND (ura.ends_at IS NULL OR ura.ends_at > NOW())
        ORDER BY m.code, ma.action_code
      `, {
        replacements: { userId, orgUnitId },
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
