'use strict';

/**
 * Resolve org filter id from list query.
 * Prefer node_id; legacy cascade params are treated as org_node ids.
 */
function resolveOrgNodeFilterId(query = {}) {
  if (query.node_id != null && query.node_id !== '') {
    return Number(query.node_id);
  }
  // Most specific legacy alias wins
  if (query.department_id != null && query.department_id !== '') {
    return Number(query.department_id);
  }
  if (query.vertical_id != null && query.vertical_id !== '') {
    return Number(query.vertical_id);
  }
  if (query.office_location_id != null && query.office_location_id !== '') {
    return Number(query.office_location_id);
  }
  return null;
}

function wantsSubtree(query = {}) {
  const v = query.include_subtree;
  if (v === false || v === 'false' || v === 0 || v === '0') return false;
  return true;
}

/**
 * Append node_membership filter against org_node.path (flexible tree).
 * Mutates conditions[] and replacements{}.
 */
function appendOrgNodeMembershipFilter(conditions, replacements, query) {
  const nodeId = resolveOrgNodeFilterId(query);
  if (!nodeId || Number.isNaN(nodeId)) return;

  replacements.nodeId = nodeId;

  if (wantsSubtree(query)) {
    conditions.push(
      'EXISTS ('
        + 'SELECT 1 FROM node_membership nm '
        + 'JOIN org_node n ON n.id = nm.node_id AND n.deleted_at IS NULL '
        + 'JOIN org_node selected ON selected.id = :nodeId AND selected.deleted_at IS NULL '
        + 'WHERE nm.user_id = ua.user_id '
        + "AND n.path LIKE selected.path || '%'"
        + ')',
    );
  } else {
    conditions.push(
      'EXISTS ('
        + 'SELECT 1 FROM node_membership nm '
        + 'JOIN org_node selected ON selected.id = :nodeId AND selected.deleted_at IS NULL '
        + 'WHERE nm.user_id = ua.user_id AND nm.node_id = selected.id'
        + ')',
    );
  }
}

module.exports = {
  resolveOrgNodeFilterId,
  wantsSubtree,
  appendOrgNodeMembershipFilter,
};
