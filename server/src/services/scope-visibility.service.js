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

    const { UserRoleAssignment, OrgNode } = require('../database/models');

    const assignments = await UserRoleAssignment.findAll({
      where: {
        user_id: userId,
        [Op.and]: [
          { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
        ],
      },
      attributes: ['scope_id'],
    });

    if (assignments.length === 0) {
      await cacheService.set(cacheKey, JSON.stringify([]), CACHE_TTL);
      return [];
    }

    const scopeIds = [...new Set(assignments.map((a) => Number(a.scope_id)).filter(Boolean))];
    const nodeIds = new Set();

    // Load the assignment nodes with their materialized paths.
    const assignmentNodes = await OrgNode.findAll({
      where: { id: { [Op.in]: scopeIds } },
      attributes: ['id', 'path'],
    });

    const descendantPrefixes = [];
    assignmentNodes.forEach((n) => {
      nodeIds.add(Number(n.id));
      if (n.path) {
        // Upward: every ancestor id encoded in the path.
        n.path.split('/').filter(Boolean).forEach((id) => nodeIds.add(Number(id)));
        // Downward prefix: any node whose path starts with this node's path.
        descendantPrefixes.push({ path: { [Op.like]: `${n.path}%` } });
      }
    });

    // Downward: all descendants of any assignment node (subtree).
    if (descendantPrefixes.length > 0) {
      const descendants = await OrgNode.findAll({
        where: { [Op.or]: descendantPrefixes },
        attributes: ['id'],
      });
      descendants.forEach((d) => nodeIds.add(Number(d.id)));
    }

    // Keys are org_node ids (globally unique) — matched against content
    // owning_scope_id regardless of the legacy owning_scope_type label.
    const keys = [...nodeIds];

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
      (arr || []).forEach((id) => {
        if (!seen.has(id)) { seen.add(id); keys.push(id); }
      });
    });

    if (keys.length === 0) {
      // No readable scope at all — only the user themselves.
      const result = [userId];
      await cacheService.set(cacheKey, JSON.stringify(result), CACHE_TTL);
      return result;
    }

    const { UserRoleAssignment } = require('../database/models');
    const peers = await UserRoleAssignment.findAll({
      where: {
        scope_id: { [Op.in]: keys },
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
 * Converts a readable-scope-keys array (org_node ids) into a Sequelize Op.or
 * condition matching content by `owning_scope_id`. Node ids are globally
 * unique so the legacy `owning_scope_type` label is not needed. Returns null if
 * keys is null (global access) or empty (no access).
 */
function buildOwningScopeOrCondition(keys) {
  if (keys === null) return null;
  if (!Array.isArray(keys) || keys.length === 0) return [];
  return keys.map((id) => ({ owning_scope_id: id }));
}

module.exports = {
  getReadableScopeKeys,
  getCollaboratorUserIds,
  buildOwningScopeOrCondition,
};
