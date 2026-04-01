const hierarchyService = require('../../services/hierarchy.service');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID, NODE_TYPES } = require('../../utils/constants');

const orgService = {
  async getFullTree() {
    return hierarchyService.getFullTree(DEFAULT_TENANT_ID);
  },

  async getById(id) {
    const { OrgUnit } = require('../../database/models');
    const orgUnit = await OrgUnit.findByPk(id, {
      include: [{ association: 'parent', attributes: ['org_unit_id', 'name', 'node_type'] }],
    });
    if (!orgUnit) throw ApiError.notFound('Org unit not found');
    return orgUnit;
  },

  async getChildren(id) {
    const { OrgUnit } = require('../../database/models');
    const parent = await OrgUnit.findByPk(id);
    if (!parent) throw ApiError.notFound('Org unit not found');

    return OrgUnit.findAll({
      where: { parent_org_unit_id: id, deleted_at: null },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
  },

  async getSubtree(id, query = {}) {
    const { OrgUnit } = require('../../database/models');
    const orgUnit = await OrgUnit.findByPk(id);
    if (!orgUnit) throw ApiError.notFound('Org unit not found');

    const maxDepth = query.max_depth ? parseInt(query.max_depth, 10) : null;
    return hierarchyService.getSubtree(id, { includeRoot: true, maxDepth });
  },

  async createNode(data, userId) {
    const { sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      // Remove org_unit_id (authorization scope) so it doesn't clash with the auto-generated PK
      const { org_unit_id, ...createData } = data;
      createData.tenant_id = DEFAULT_TENANT_ID;
      const orgUnit = await hierarchyService.createOrgUnit(createData, transaction);

      await auditService.log({
        user_id: userId,
        action: 'ORG_UNIT_CREATED',
        resource_type: 'OrgUnit',
        resource_id: orgUnit.org_unit_id,
        details: { node_type: data.node_type, name: data.name },
      });

      await transaction.commit();
      // Invalidate org tree cache
      await cacheService.deletePattern('bh:org:tree:*');
      return orgUnit;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateNode(id, expectedType, data) {
    const { OrgUnit } = require('../../database/models');
    const orgUnit = await OrgUnit.findByPk(id);
    if (!orgUnit) throw ApiError.notFound('Org unit not found');
    if (orgUnit.node_type !== expectedType) {
      throw ApiError.badRequest(`Expected ${expectedType}, got ${orgUnit.node_type}`);
    }

    const allowedFields = ['name', 'code', 'status', 'sort_order', 'address', 'city', 'country', 'timezone'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    await orgUnit.update(updates);
    await cacheService.deletePattern('bh:org:tree:*');
    return orgUnit;
  },

  async deleteNode(id, expectedType, userId) {
    const { OrgUnit } = require('../../database/models');
    const orgUnit = await OrgUnit.findByPk(id);
    if (!orgUnit) throw ApiError.notFound('Org unit not found');
    if (orgUnit.node_type !== expectedType) {
      throw ApiError.badRequest(`Expected ${expectedType}, got ${orgUnit.node_type}`);
    }

    // Check for children
    const children = await OrgUnit.findAll({
      where: { parent_org_unit_id: id, deleted_at: null },
    });
    if (children.length > 0) {
      throw ApiError.conflict(
        'Cannot delete org unit with children. Remove children first.'
      );
    }

    await orgUnit.update({ deleted_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'ORG_UNIT_DELETED',
      resource_type: 'OrgUnit',
      resource_id: id,
      details: { node_type: expectedType, name: orgUnit.name },
    });

    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Org unit deleted successfully' };
  },
};

module.exports = orgService;
