const { QueryTypes } = require('sequelize');

/**
 * Tree-based scope resolution over the generic `org_node` table.
 *
 * A scope is identified by an integer `scope_id` which is an `org_node.id`
 * (globally unique across the whole tree). `scope_type` is retained on the
 * scope-bearing tables for backwards compatibility but is informational — all
 * ancestry is resolved by walking the node tree, so a role granted at any
 * ancestor node covers every descendant, at any depth.
 */
const scopeService = {
  /**
   * Load a node's ancestor chain (inclusive of the node itself) as an ordered
   * array of { id, node_type, parent_id, name }, nearest-first (self → root).
   * Uses the materialized `path` when present, else walks parent_id.
   */
  async resolveAncestorNodes(scopeId) {
    const { sequelize } = require('../database/models');
    const id = Number(scopeId);
    if (!Number.isInteger(id)) return [];

    const [node] = await sequelize.query(
      'SELECT id, node_type, parent_id, name, path FROM org_node WHERE id = :id',
      { replacements: { id }, type: QueryTypes.SELECT },
    );
    if (!node) return [];

    let rows;
    if (node.path) {
      // path looks like "1/2/5/"; the ids are the full chain root → self.
      const ids = node.path.split('/').filter(Boolean).map(Number);
      rows = await sequelize.query(
        'SELECT id, node_type, parent_id, name FROM org_node WHERE id IN (:ids)',
        { replacements: { ids }, type: QueryTypes.SELECT },
      );
    } else {
      // Fallback: walk parent_id upward.
      rows = [];
      let current = node;
      const guard = new Set();
      while (current && !guard.has(current.id)) {
        guard.add(current.id);
        rows.push({ id: current.id, node_type: current.node_type, parent_id: current.parent_id, name: current.name });
        if (current.parent_id == null) break;
        // eslint-disable-next-line no-await-in-loop
        const [parent] = await sequelize.query(
          'SELECT id, node_type, parent_id, name, path FROM org_node WHERE id = :id',
          { replacements: { id: current.parent_id }, type: QueryTypes.SELECT },
        );
        current = parent;
      }
    }

    // Order nearest-first (self → root) by descending depth (path length).
    const byId = new Map(rows.map((r) => [r.id, r]));
    const chain = [];
    let cur = byId.get(id);
    const guard = new Set();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      chain.push(cur);
      cur = cur.parent_id != null ? byId.get(cur.parent_id) : null;
    }
    return chain;
  },

  /**
   * The node id + all ancestor ids. This is the set a permission check matches
   * against: a role assigned at any of these covers the target scope.
   */
  async resolveAncestorIds(scopeId) {
    const nodes = await this.resolveAncestorNodes(scopeId);
    return nodes.map((n) => n.id);
  },

  /**
   * Legacy-compatible ancestor shape. Returns the nearest ancestor node id for
   * each of the four historical levels (the root GROUP maps to organisation_id).
   * Retained so existing consumers (e.g. checkAdminHierarchyPermission,
   * audience level filtering) keep working against the new tree.
   */
  async resolveAncestors(scopeType, scopeId) {
    const nodes = await this.resolveAncestorNodes(scopeId);
    if (nodes.length === 0) return null;

    const nearest = (type) => {
      const hit = nodes.find((n) => n.node_type === type);
      return hit ? hit.id : null;
    };
    const root = nodes[nodes.length - 1];

    return {
      // GROUP (tree root) fills the historical ORGANISATION slot.
      organisation_id: nearest('GROUP') || (root && root.parent_id == null ? root.id : null),
      office_location_id: nearest('OFFICE_LOCATION'),
      vertical_id: nearest('VERTICAL'),
      department_id: nearest('DEPARTMENT'),
    };
  },

  /**
   * True if parent scope is an ancestor of (or equal to) the child scope.
   * Signature keeps the legacy (type,id,type,id) shape; only the ids matter now.
   */
  async isAncestorOf(parentType, parentId, childType, childId) {
    const pId = Number(parentId);
    const cId = Number(childId);
    if (!Number.isInteger(pId) || !Number.isInteger(cId)) return false;
    if (pId === cId) return true;
    const ancestorIds = await this.resolveAncestorIds(cId);
    return ancestorIds.includes(pId);
  },

  /**
   * Display name for a scope (node) id.
   */
  async getScopeName(scopeType, scopeId) {
    const { sequelize } = require('../database/models');
    const [row] = await sequelize.query(
      'SELECT name FROM org_node WHERE id = :id',
      { replacements: { id: Number(scopeId) }, type: QueryTypes.SELECT },
    );
    return row ? row.name : null;
  },
};

module.exports = scopeService;
