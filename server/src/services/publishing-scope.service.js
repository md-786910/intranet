const ApiError = require('../utils/ApiError');
const scopeService = require('./scope.service');
const logger = require('../config/logger');

/**
 * Defence-in-depth: ensure a publisher only targets audience scopes they
 * actually own (per their user_role_assignment rows).
 *
 * - OWNER role: unrestricted.
 * - ORGANISATION-scope assignment: unrestricted (matches today's behavior
 *   for org-wide Content Editors).
 * - Sub-org only: each target must equal one of the user's assignments OR
 *   be a descendant of one.
 *
 * Throws `403 SCOPE_OUT_OF_BOUNDS` if any target is outside the allowed set.
 */
async function assertAudienceWithinUserScope(userId, audienceTargets) {
  if (!Array.isArray(audienceTargets) || audienceTargets.length === 0) {
    return;
  }

  const { UserRoleAssignment, Role } = require('../database/models');
  const { Op } = require('sequelize');

  const assignments = await UserRoleAssignment.findAll({
    where: {
      user_id: userId,
      [Op.and]: [
        { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
        { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
      ],
    },
    include: [{ model: Role, as: 'role', attributes: ['code'] }],
    attributes: ['scope_type', 'scope_id'],
  });

  if (assignments.some((a) => a.role?.code === 'OWNER')) return;
  if (assignments.some((a) => a.scope_type === 'ORGANISATION')) return;

  if (assignments.length === 0) {
    throw ApiError.forbidden('SCOPE_OUT_OF_BOUNDS: user has no scope assignments');
  }

  for (const target of audienceTargets) {
    let covered = false;
    for (const assignment of assignments) {
      // eslint-disable-next-line no-await-in-loop
      const ok = await scopeService.isAncestorOf(
        assignment.scope_type,
        assignment.scope_id,
        target.scope_type,
        target.scope_id,
      );
      if (ok) { covered = true; break; }
    }
    if (!covered) {
      logger.warn(
        `Audience target out of scope: user=${userId} target=${target.scope_type}:${target.scope_id}`,
      );
      throw ApiError.forbidden(
        `SCOPE_OUT_OF_BOUNDS: target ${target.scope_type}:${target.scope_id} is outside your assigned scope`,
      );
    }
  }
}

module.exports = {
  assertAudienceWithinUserScope,
};
