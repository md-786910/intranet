const scopeService = require('./scope.service');
const visibilityConfig = require('../config/visibility.config');

// Ordered operational levels, plus ADMIN_UNIT for the administrative branch.
// Node ids are globally unique, so audience matching is ultimately id-based;
// this list only drives the optional per-entity level filtering below.
const SCOPE_HIERARCHY = ['GROUP', 'COMPANY', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'];
const ALL_LEVELS = [...SCOPE_HIERARCHY, 'ADMIN_UNIT'];

// visibility.config still speaks the legacy 'ORGANISATION' label; treat it as
// the tree root (GROUP).
function normalizeLevel(level) {
  return level === 'ORGANISATION' ? 'GROUP' : level;
}

// Resolve which node levels count toward a user's audience coverage. Precedence:
//   1. `audienceLevels` allow-list (explicit set of levels)
//   2. `minLevel` shorthand (everything from the root down to that level)
//   3. fallback — every level
function resolveAllowedLevels(entity) {
  const cfg = visibilityConfig[entity] || {};
  if (Array.isArray(cfg.audienceLevels) && cfg.audienceLevels.length > 0) {
    const valid = cfg.audienceLevels.map(normalizeLevel).filter((l) => ALL_LEVELS.includes(l));
    if (valid.length > 0) return new Set(valid);
  }
  const lvl = normalizeLevel(cfg.minLevel);
  if (lvl && SCOPE_HIERARCHY.includes(lvl)) {
    const minIdx = SCOPE_HIERARCHY.indexOf(lvl);
    return new Set(SCOPE_HIERARCHY.filter((_, idx) => idx <= minIdx));
  }
  return new Set(ALL_LEVELS);
}

async function getUserAudienceScopeKeys(userId, entity = 'documents') {
  const {
    UserRoleAssignment,
    UserPermission,
    NodeMembership,
  } = require('../database/models');

  const allowedLevels = resolveAllowedLevels(entity);
  // Keys are org_node ids (globally unique). A rule targeting node N matches a
  // user whose scope coverage (self + ancestors, filtered by allowed levels)
  // includes N.
  const scopeKeys = new Set();

  const addAncestors = async (scopeId) => {
    if (!scopeId) return;
    const nodes = await scopeService.resolveAncestorNodes(scopeId);
    nodes.forEach((n) => {
      if (allowedLevels.has(n.node_type)) scopeKeys.add(Number(n.id));
    });
  };

  const [roleAssignments, directPermissions, nodeMemberships] = await Promise.all([
    UserRoleAssignment.findAll({
      where: { user_id: userId },
      attributes: ['scope_id'],
    }),
    UserPermission.findAll({
      where: { user_id: userId, effect: 'ALLOW' },
      attributes: ['scope_id'],
    }),
    NodeMembership.findAll({
      where: { user_id: userId },
      attributes: ['node_id'],
    }),
  ]);

  for (const a of roleAssignments) await addAncestors(a.scope_id);
  for (const p of directPermissions) await addAncestors(p.scope_id);
  for (const m of nodeMemberships) await addAncestors(m.node_id);

  return scopeKeys;
}

// A document/article with no explicit audience rules is visible to everyone
// (org-wide). Otherwise it must match at least one of the user's scope keys.
// target_scope_id is an org_node id after the tree migration.
function matchesAudience(audienceRules, userScopeKeys) {
  const rules = audienceRules || [];
  if (rules.length === 0) return true;
  return rules.some((rule) => userScopeKeys.has(Number(rule.target_scope_id)));
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
