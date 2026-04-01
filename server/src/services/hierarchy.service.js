const { QueryTypes } = require('sequelize');
const ApiError = require('../utils/ApiError');
const { VALID_PARENT_MAP } = require('../utils/constants');
const logger = require('../config/logger');

const hierarchyService = {
  /**
   * Validate hierarchy rules and create an org unit.
   * Full implementation in Week 2.
   */
  async createOrgUnit(data, transaction) {
    const { OrgUnit, OrgUnitClosure, sequelize } = require('../database/models');
    const { node_type, parent_org_unit_id } = data;
    const requiredParentType = VALID_PARENT_MAP[node_type];

    // Validate parent relationship
    if (requiredParentType === null) {
      if (parent_org_unit_id) {
        throw ApiError.badRequest('Organisation must be root (no parent)');
      }
    } else {
      if (!parent_org_unit_id) {
        throw ApiError.badRequest(`${node_type} requires a parent`);
      }
      const parent = await OrgUnit.findByPk(parent_org_unit_id, { transaction });
      if (!parent) {
        throw ApiError.notFound('Parent org unit not found');
      }
      if (parent.node_type !== requiredParentType) {
        throw ApiError.badRequest(
          `${node_type} must be under ${requiredParentType}, got ${parent.node_type}`
        );
      }
    }

    // Build materialized path
    let path = data.code || data.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    if (parent_org_unit_id) {
      const parent = await OrgUnit.findByPk(parent_org_unit_id, { transaction });
      path = `${parent.path}.${path}`;
    }

    const orgUnit = await OrgUnit.create({ ...data, path }, { transaction });

    // Maintain closure table
    await this.rebuildClosureForNode(orgUnit, transaction);

    return orgUnit;
  },

  /**
   * Populate closure table entries for a new node.
   */
  async rebuildClosureForNode(orgUnit, transaction) {
    const { OrgUnitClosure, sequelize } = require('../database/models');

    // Self-reference (depth 0)
    await OrgUnitClosure.create({
      ancestor_org_unit_id: orgUnit.org_unit_id,
      descendant_org_unit_id: orgUnit.org_unit_id,
      depth: 0,
    }, { transaction });

    // Copy parent's ancestors with depth + 1
    if (orgUnit.parent_org_unit_id) {
      await sequelize.query(`
        INSERT INTO org_unit_closure (ancestor_org_unit_id, descendant_org_unit_id, depth)
        SELECT ancestor_org_unit_id, :newId, depth + 1
        FROM org_unit_closure
        WHERE descendant_org_unit_id = :parentId
      `, {
        replacements: {
          newId: orgUnit.org_unit_id,
          parentId: orgUnit.parent_org_unit_id,
        },
        type: QueryTypes.INSERT,
        transaction,
      });
    }
  },

  /**
   * Get the full subtree under a given org unit.
   */
  async getSubtree(orgUnitId, { includeRoot = true, maxDepth = null } = {}) {
    const { sequelize } = require('../database/models');
    let depthClause = '';
    if (!includeRoot) depthClause += ' AND oc.depth > 0';
    if (maxDepth !== null) depthClause += ` AND oc.depth <= ${parseInt(maxDepth, 10)}`;

    return sequelize.query(`
      SELECT ou.*, oc.depth
      FROM org_unit ou
      JOIN org_unit_closure oc
        ON oc.descendant_org_unit_id = ou.org_unit_id
       AND oc.ancestor_org_unit_id = :orgUnitId
       ${depthClause}
      WHERE ou.deleted_at IS NULL
      ORDER BY oc.depth, ou.sort_order, ou.name
    `, {
      replacements: { orgUnitId },
      type: QueryTypes.SELECT,
    });
  },

  /**
   * Get ancestors (path to root) for a given org unit.
   */
  async getAncestors(orgUnitId) {
    const { sequelize } = require('../database/models');

    return sequelize.query(`
      SELECT ou.*, oc.depth
      FROM org_unit ou
      JOIN org_unit_closure oc
        ON oc.ancestor_org_unit_id = ou.org_unit_id
       AND oc.descendant_org_unit_id = :orgUnitId
      WHERE ou.deleted_at IS NULL
      ORDER BY oc.depth DESC
    `, {
      replacements: { orgUnitId },
      type: QueryTypes.SELECT,
    });
  },

  /**
   * Build full tree structure for admin UI display.
   */
  async getFullTree(tenantId) {
    const { OrgUnit } = require('../database/models');

    const nodes = await OrgUnit.findAll({
      where: { tenant_id: tenantId, deleted_at: null },
      order: [['path', 'ASC'], ['sort_order', 'ASC']],
      raw: true,
    });

    const nodeMap = {};
    const roots = [];

    nodes.forEach((n) => {
      nodeMap[n.org_unit_id] = { ...n, children: [] };
    });

    nodes.forEach((n) => {
      if (n.parent_org_unit_id && nodeMap[n.parent_org_unit_id]) {
        nodeMap[n.parent_org_unit_id].children.push(nodeMap[n.org_unit_id]);
      } else if (!n.parent_org_unit_id) {
        roots.push(nodeMap[n.org_unit_id]);
      }
    });

    return roots;
  },
};

module.exports = hierarchyService;
