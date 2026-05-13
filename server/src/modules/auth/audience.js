// Audience gate — restricts which users can sign into which frontend.
//
//   admin    → owner / office manager / content editor (anyone with an
//              admin-side role assignment). Plain EMPLOYEEs are rejected.
//   employee → any valid account. EMPLOYEEs are obviously allowed, and
//              admin-side roles also work (e.g. an OWNER can use either app).
//
// This runs *after* the user is authenticated but *before* tokens are issued,
// so both password login and Microsoft sign-in share the same enforcement.

const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');

const VALID_AUDIENCES = ['admin', 'employee'];
const DEFAULT_AUDIENCE = 'employee';

function normalizeAudience(value) {
  if (!value) return DEFAULT_AUDIENCE;
  return VALID_AUDIENCES.includes(value) ? value : DEFAULT_AUDIENCE;
}

/**
 * Throws 403 if the user is not allowed to sign into the requested audience.
 * For audience='admin', the user must have at least one non-EMPLOYEE role
 * assignment (OWNER, OFFICE_MANAGER, CONTENT_EDITOR, or any custom role).
 */
async function assertAudienceAllowed(userId, rawAudience) {
  const audience = normalizeAudience(rawAudience);
  if (audience !== 'admin') return;

  const { UserRoleAssignment, Role } = require('../../database/models');

  const assignments = await UserRoleAssignment.findAll({
    where: {
      user_id: userId,
      [Op.and]: [
        { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
        { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
      ],
    },
    include: [{ model: Role, as: 'role', attributes: ['code'] }],
    attributes: ['assignment_id'],
  });

  const hasAdminRole = assignments.some((a) => a.role && a.role.code !== 'EMPLOYEE');
  if (!hasAdminRole) {
    throw ApiError.forbidden(
      'This account does not have permission to access the admin panel.',
    );
  }
}

module.exports = { assertAudienceAllowed, normalizeAudience };
