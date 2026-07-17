const ApiError = require('../utils/ApiError');
const { ALLOWED_CHILDREN, NODE_KIND } = require('../utils/constants');

const hierarchyService = {
  /**
   * Build the full generic org_node tree for an organisation. Returns the root
   * node (GROUP) with recursively nested `children` and a `memberCount` per node.
   */
  async getTree(organisationId) {
    const { fn, col } = require('sequelize');
    const { OrgNode, NodeMembership } = require('../database/models');

    const nodes = await OrgNode.findAll({
      where: { organisation_id: organisationId },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    const counts = await NodeMembership.findAll({
      attributes: ['node_id', [fn('COUNT', col('membership_id')), 'cnt']],
      group: ['node_id'],
      raw: true,
    });
    const countByNode = new Map(counts.map((c) => [Number(c.node_id), Number(c.cnt)]));

    const byId = new Map();
    nodes.forEach((n) => {
      const plain = n.toJSON();
      plain.children = [];
      plain.memberCount = countByNode.get(Number(n.id)) || 0;
      byId.set(Number(n.id), plain);
    });

    const roots = [];
    byId.forEach((node) => {
      if (node.parent_id != null && byId.has(Number(node.parent_id))) {
        byId.get(Number(node.parent_id)).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Single organisation → single GROUP root. Return it directly.
    return roots.find((r) => r.node_type === 'GROUP') || roots[0] || null;
  },

  /**
   * Create a node under a parent, enforcing the allowed-children policy and
   * computing its materialized path. Runs inside the given transaction.
   */
  async createNode(data, transaction) {
    const { OrgNode } = require('../database/models');

    let parent = null;
    if (data.parent_id != null) {
      parent = await OrgNode.findByPk(data.parent_id, { transaction });
      if (!parent) throw ApiError.notFound('Parent node not found');
    }

    const nodeType = data.node_type;
    if (parent) {
      const allowed = ALLOWED_CHILDREN[parent.node_type] || [];
      if (!allowed.includes(nodeType)) {
        throw ApiError.badRequest(`A ${nodeType} cannot be created under a ${parent.node_type}`);
      }
    } else if (nodeType !== 'GROUP') {
      throw ApiError.badRequest('Only a GROUP node may exist without a parent');
    }

    // Derive kind: ADMIN_UNIT is always administrative, COMPANY always
    // operational, everything else inherits its parent's branch.
    let kind = data.kind;
    if (nodeType === 'ADMIN_UNIT') kind = NODE_KIND.ADMINISTRATIVE;
    else if (nodeType === 'COMPANY' || nodeType === 'GROUP') kind = NODE_KIND.OPERATIONAL;
    else if (!kind) kind = parent ? parent.kind : NODE_KIND.OPERATIONAL;

    const isOffice = nodeType === 'OFFICE_LOCATION';
    const node = await OrgNode.create({
      organisation_id: data.organisation_id,
      parent_id: data.parent_id || null,
      node_type: nodeType,
      kind,
      name: data.name,
      code: data.code || null,
      status: data.status || 'ACTIVE',
      address: isOffice ? (data.address || null) : null,
      city: isOffice ? (data.city || null) : null,
      country: isOffice ? (data.country || null) : null,
      timezone: isOffice ? (data.timezone || null) : null,
      sort_order: data.sort_order || 0,
    }, { transaction });

    const path = parent ? `${parent.path}${node.id}/` : `${node.id}/`;
    await node.update({ path }, { transaction });

    return node;
  },

  // ── Legacy per-level helpers (retained for the pre-migration endpoints; the
  //    generic /org/nodes API supersedes these) ──

  async getFullTree(organisationId) {
    // Delegates to the generic node tree so the /org/tree endpoint reflects the
    // new structure.
    return this.getTree(organisationId);
  },

  async createOfficeLocation(data, transaction) {
    const { Organisation, OfficeLocation } = require('../database/models');
    const org = await Organisation.findByPk(data.organisation_id, { transaction });
    if (!org) throw ApiError.notFound('Organisation not found');
    return OfficeLocation.create(data, { transaction });
  },

  async createVertical(data, transaction) {
    const { OfficeLocation, Vertical } = require('../database/models');
    const office = await OfficeLocation.findByPk(data.office_location_id, { transaction });
    if (!office) throw ApiError.notFound('Office location not found');
    return Vertical.create(data, { transaction });
  },

  async createDepartment(data, transaction) {
    const { Vertical, Department } = require('../database/models');
    const vertical = await Vertical.findByPk(data.vertical_id, { transaction });
    if (!vertical) throw ApiError.notFound('Vertical not found');
    return Department.create(data, { transaction });
  },
};

module.exports = hierarchyService;
