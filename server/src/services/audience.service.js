const scopeService = require('./scope.service');
const visibilityConfig = require('../config/visibility.config');

const SCOPE_HIERARCHY = ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'];

const SCOPE_KEY_FIELD = {
  ORGANISATION: 'organisation_id',
  OFFICE_LOCATION: 'office_location_id',
  VERTICAL: 'vertical_id',
  DEPARTMENT: 'department_id',
};

function resolveMinLevel(entity) {
  const cfg = visibilityConfig[entity];
  const lvl = cfg && cfg.minLevel;
  if (lvl && SCOPE_HIERARCHY.includes(lvl)) return lvl;
  return 'DEPARTMENT';
}

async function getUserAudienceScopeKeys(userId, entity = 'documents') {
  const {
    UserRoleAssignment,
    UserPermission,
    DepartmentMembership,
  } = require('../database/models');

  const minLevel = resolveMinLevel(entity);
  const minIdx = SCOPE_HIERARCHY.indexOf(minLevel);
  const scopeKeys = new Set();

  const addAncestors = async (scopeType, scopeId) => {
    if (!scopeType || !scopeId) return;
    const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
    if (!ancestors) return;

    // Only include levels at-or-above the configured minimum (lower index = broader).
    SCOPE_HIERARCHY.forEach((level, idx) => {
      if (idx > minIdx) return;
      const id = ancestors[SCOPE_KEY_FIELD[level]];
      if (id) scopeKeys.add(`${level}:${id}`);
    });
  };

  const [roleAssignments, directPermissions, departmentMemberships] = await Promise.all([
    UserRoleAssignment.findAll({
      where: { user_id: userId },
      attributes: ['scope_type', 'scope_id'],
    }),
    UserPermission.findAll({
      where: { user_id: userId, effect: 'ALLOW' },
      attributes: ['scope_type', 'scope_id'],
    }),
    DepartmentMembership.findAll({
      where: { user_id: userId },
      attributes: ['department_id'],
    }),
  ]);

  for (const a of roleAssignments) await addAncestors(a.scope_type, a.scope_id);
  for (const p of directPermissions) await addAncestors(p.scope_type, p.scope_id);
  for (const m of departmentMemberships) await addAncestors('DEPARTMENT', m.department_id);

  return scopeKeys;
}

// A document/article with no explicit audience rules is visible to everyone
// (org-wide). Otherwise it must match at least one of the user's scope keys.
function matchesAudience(audienceRules, userScopeKeys) {
  const rules = audienceRules || [];
  if (rules.length === 0) return true;
  return rules.some((rule) =>
    userScopeKeys.has(`${rule.target_scope_type}:${rule.target_scope_id}`));
}

module.exports = {
  getUserAudienceScopeKeys,
  matchesAudience,
  SCOPE_HIERARCHY,
};
