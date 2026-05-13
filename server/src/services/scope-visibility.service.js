const { Op } = require('sequelize');
const permissionService = require('./permission.service');
const cacheService = require('./cache.service');
const logger = require('../config/logger');

const CACHE_TTL = 300; // 5 minutes — match permission cache

/**
 * Read-side counterpart to publishing-scope.service.
 *
 * Returns the set of (scope_type, scope_id) pairs this user is allowed to
 * SEE for content belonging to `moduleCode`. The rule mirrors the publish
 * guard but inverted: each role assignment expands to itself plus all
 * descendant scopes.
 *
 *   ORGANISATION:O   → O + offices + verticals + departments under it
 *   OFFICE_LOCATION  → office + verticals + departments under it
 *   VERTICAL         → vertical + departments under it
 *   DEPARTMENT       → department only
 *
 * Returns `null` when the user is a global manager (Owner or any
 * ORG-scope role granting CREATE/EDIT/PUBLISH/DELETE on the module) —
 * indicating "no filter, show everything". An empty array means
 * "the user has no readable scope" → callers should short-circuit to []. */
async function getReadableScopeKeys(userId, moduleCode) {
  if (!userId) return [];

  const cacheKey = `scope:read:${userId}:${moduleCode}`;
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) return cached === 'GLOBAL' ? null : JSON.parse(cached);

  try {
    if (await permissionService.isGlobalManager(userId, moduleCode)) {
      await cacheService.set(cacheKey, 'GLOBAL', CACHE_TTL);
      return null;
    }

    const {
      UserRoleAssignment,
      OfficeLocation,
      Vertical,
      Department,
    } = require('../database/models');

    const assignments = await UserRoleAssignment.findAll({
      where: {
        user_id: userId,
        [Op.and]: [
          { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
        ],
      },
      attributes: ['scope_type', 'scope_id'],
    });

    if (assignments.length === 0) {
      await cacheService.set(cacheKey, JSON.stringify([]), CACHE_TTL);
      return [];
    }

    const orgIds = new Set();
    const officeIds = new Set();
    const verticalIds = new Set();
    const departmentIds = new Set();

    assignments.forEach((a) => {
      switch (a.scope_type) {
        case 'ORGANISATION': orgIds.add(a.scope_id); break;
        case 'OFFICE_LOCATION': officeIds.add(a.scope_id); break;
        case 'VERTICAL': verticalIds.add(a.scope_id); break;
        case 'DEPARTMENT': departmentIds.add(a.scope_id); break;
        default: break;
      }
    });

    // Expand: ORGANISATION → all offices under it
    if (orgIds.size > 0) {
      const offices = await OfficeLocation.findAll({
        where: { organisation_id: { [Op.in]: [...orgIds] } },
        attributes: ['id'],
      });
      offices.forEach((o) => officeIds.add(o.id));
    }

    // OFFICE_LOCATION → all verticals under it
    if (officeIds.size > 0) {
      const verticals = await Vertical.findAll({
        where: { office_location_id: { [Op.in]: [...officeIds] } },
        attributes: ['id'],
      });
      verticals.forEach((v) => verticalIds.add(v.id));
    }

    // VERTICAL → all departments under it
    if (verticalIds.size > 0) {
      const departments = await Department.findAll({
        where: { vertical_id: { [Op.in]: [...verticalIds] } },
        attributes: ['id'],
      });
      departments.forEach((d) => departmentIds.add(d.id));
    }

    const keys = [
      ...[...orgIds].map((id) => ({ type: 'ORGANISATION', id })),
      ...[...officeIds].map((id) => ({ type: 'OFFICE_LOCATION', id })),
      ...[...verticalIds].map((id) => ({ type: 'VERTICAL', id })),
      ...[...departmentIds].map((id) => ({ type: 'DEPARTMENT', id })),
    ];

    await cacheService.set(cacheKey, JSON.stringify(keys), CACHE_TTL);
    return keys;
  } catch (err) {
    logger.error(`getReadableScopeKeys error: ${err.message}`);
    return [];
  }
}

/**
 * Returns the set of user_ids whose role-assignment scope OVERLAPS with the
 * current user's readable scope set (always includes the user themselves).
 *
 * Used by Media + Categories where the entity has no `owning_scope` — we
 * fall back to "uploaded/created by a user whose scope overlaps mine".
 *
 * `moduleCodes` is the modules to consider for the "global manager"
 * short-circuit (e.g. media is shared by NEWS+DOCUMENTS).
 */
async function getCollaboratorUserIds(userId, moduleCodes = ['NEWS', 'DOCUMENTS']) {
  if (!userId) return [];

  const cacheKey = `scope:peers:${userId}:${moduleCodes.join(',')}`;
  const cached = await cacheService.get(cacheKey);
  if (cached !== null) return cached === 'GLOBAL' ? null : JSON.parse(cached);

  try {
    const globals = await Promise.all(moduleCodes.map((m) => permissionService.isGlobalManager(userId, m)));
    if (globals.some(Boolean)) {
      await cacheService.set(cacheKey, 'GLOBAL', CACHE_TTL);
      return null;
    }

    // Union the readable keys across all listed modules.
    const allKeysArrays = await Promise.all(moduleCodes.map((m) => getReadableScopeKeys(userId, m)));
    if (allKeysArrays.some((k) => k === null)) {
      await cacheService.set(cacheKey, 'GLOBAL', CACHE_TTL);
      return null;
    }

    const seen = new Set();
    const keys = [];
    allKeysArrays.forEach((arr) => {
      (arr || []).forEach((k) => {
        const sig = `${k.type}:${k.id}`;
        if (!seen.has(sig)) { seen.add(sig); keys.push(k); }
      });
    });

    if (keys.length === 0) {
      // No readable scope at all — only the user themselves.
      const result = [userId];
      await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    }

    const { UserRoleAssignment } = require('../database/models');
    const orConditions = keys.map((k) => ({ scope_type: k.type, scope_id: k.id }));
    const peers = await UserRoleAssignment.findAll({
      where: {
        [Op.or]: orConditions,
        [Op.and]: [
          { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
        ],
      },
      attributes: ['user_id'],
      raw: true,
    });

    const userIdSet = new Set([userId, ...peers.map((p) => p.user_id)]);
    const result = [...userIdSet];

    await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
    return result;
  } catch (err) {
    logger.error(`getCollaboratorUserIds error: ${err.message}`);
    return [userId];
  }
}

/**
 * Converts a readable-scope-keys array into a Sequelize Op.or condition
 * matching `(owning_scope_type, owning_scope_id)` pairs. Returns null if
 * keys is null (global access) or empty (no access).
 */
function buildOwningScopeOrCondition(keys) {
  if (keys === null) return null;
  if (!Array.isArray(keys) || keys.length === 0) return [];
  return keys.map((k) => ({
    owning_scope_type: k.type,
    owning_scope_id: k.id,
  }));
}

module.exports = {
  getReadableScopeKeys,
  getCollaboratorUserIds,
  buildOwningScopeOrCondition,
};
