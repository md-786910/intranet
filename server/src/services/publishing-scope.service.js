const ApiError = require('../utils/ApiError');
const scopeService = require('./scope.service');
const logger = require('../config/logger');

const ORG_WIDE_TYPES = new Set(['ORGANISATION', 'GROUP']);
const PUBLISH_ANYWHERE_ROLES = new Set(['OWNER', 'CONTENT_EDITOR', 'OFFICE_MANAGER']);

function isOrgWideAssignment(assignment) {
  return ORG_WIDE_TYPES.has(assignment.scope_type);
}

/**
 * Defence-in-depth: ensure a publisher only targets audience scopes they
 * actually own (per their user_role_assignment rows).
 *
 * Unrestricted audience when:
 * - OWNER role (any scope)
 * - CONTENT_EDITOR / OFFICE_MANAGER assigned at ORGANISATION/GROUP
 * - Any ORGANISATION/GROUP-scope assignment
 *
 * Company/office/dept-only editors: each target must equal one of their
 * assignments OR be a descendant of one.
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

  // OWNER is unrestricted regardless of assignment scope.
  if (assignments.some((a) => a.role?.code === 'OWNER')) return;

  // Org-wide Content Editor / Office Manager (or any org/group assignment) may pick freely.
  const hasOrgWidePublishRole = assignments.some(
    (a) => a.role?.code
      && PUBLISH_ANYWHERE_ROLES.has(a.role.code)
      && isOrgWideAssignment(a),
  );
  if (hasOrgWidePublishRole) return;
  if (assignments.some(isOrgWideAssignment)) return;

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
