const scopeService = require('./scope.service');
const visibilityConfig = require('../config/visibility.config');

const SCOPE_HIERARCHY = ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'];

const SCOPE_KEY_FIELD = {
  ORGANISATION: 'organisation_id',
  OFFICE_LOCATION: 'office_location_id',
  VERTICAL: 'vertical_id',
  DEPARTMENT: 'department_id',
};

// Resolve the set of scope levels honoured for an entity. Precedence:
//   1. `audienceLevels` allow-list (explicit set of levels)
//   2. `minLevel` shorthand (everything from ORG down to that level)
//   3. fallback — all four levels
function resolveAllowedLevels(entity) {
  const cfg = visibilityConfig[entity] || {};
  if (Array.isArray(cfg.audienceLevels) && cfg.audienceLevels.length > 0) {
    const valid = cfg.audienceLevels.filter((l) => SCOPE_HIERARCHY.includes(l));
    if (valid.length > 0) return new Set(valid);
  }
  const lvl = cfg.minLevel;
  if (lvl && SCOPE_HIERARCHY.includes(lvl)) {
    const minIdx = SCOPE_HIERARCHY.indexOf(lvl);
    return new Set(SCOPE_HIERARCHY.filter((_, idx) => idx <= minIdx));
  }
  return new Set(SCOPE_HIERARCHY);
}

async function getUserAudienceScopeKeys(userId, entity = 'documents') {
  const {
    UserRoleAssignment,
    UserPermission,
    DepartmentMembership,
  } = require('../database/models');

  const allowedLevels = resolveAllowedLevels(entity);
  const scopeKeys = new Set();

  const addAncestors = async (scopeType, scopeId) => {
    if (!scopeType || !scopeId) return;
    const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
    if (!ancestors) return;

    // Only include levels enabled by the visibility config.
    SCOPE_HIERARCHY.forEach((level) => {
      if (!allowedLevels.has(level)) return;
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

// Resolve the set of user_ids that should receive a notification for content
// matching `audienceRules`. Reuses the exact visibility logic above so the
// notification audience never drifts from the list-endpoint audience.
//
// Algorithm: enumerate every active user in the tenant, expand their scope
// keys (which includes ORG / OFFICE_LOCATION / VERTICAL / DEPARTMENT ancestors
// via scopeService.resolveAncestors), then keep those whose keys satisfy
// matchesAudience for the given rules.
//
// Empty rules → org-wide → everyone in tenant.
async function getRecipientUserIds(audienceRules, entity) {
  const { UserAccount } = require('../database/models');

  // user_account doesn't carry tenant_id — the deployment is single-tenant.
  // The `active` scope filters status='ACTIVE' AND deleted_at IS NULL,
  // matching how the rest of the codebase scopes "real" employees.
  const users = await UserAccount.scope('active').findAll({
    attributes: ['user_id'],
  });
  if (!audienceRules || audienceRules.length === 0) {
    return users.map((u) => u.user_id);
  }

  const recipientIds = [];
  for (const u of users) {
    // eslint-disable-next-line no-await-in-loop
    const keys = await getUserAudienceScopeKeys(u.user_id, entity);
    if (matchesAudience(audienceRules, keys)) recipientIds.push(u.user_id);
  }
  return recipientIds;
}

module.exports = {
  getUserAudienceScopeKeys,
  matchesAudience,
  getRecipientUserIds,
  resolveAllowedLevels,
  SCOPE_HIERARCHY,
};
