const hierarchyService = require('../../services/hierarchy.service');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_ORGANISATION_ID } = require('../../utils/constants');

const orgService = {
  async getFullTree() {
    return hierarchyService.getFullTree(DEFAULT_ORGANISATION_ID);
  },

  async getNodeById(id) {
    const { Organisation, OfficeLocation, Vertical, Department } = require('../../database/models');
    // Try each level in order
    let node = await Organisation.findByPk(id);
    if (node) return { ...node.toJSON(), type: 'organisation' };

    node = await OfficeLocation.findOne({ where: { id, deleted_at: null } });
    if (node) return { ...node.toJSON(), type: 'office_location' };

    node = await Vertical.findOne({ where: { id, deleted_at: null } });
    if (node) return { ...node.toJSON(), type: 'vertical' };

    node = await Department.findOne({ where: { id, deleted_at: null } });
    if (node) return { ...node.toJSON(), type: 'department' };

    throw ApiError.notFound('Org node not found');
  },

  async getChildren(id) {
    const { Organisation, OfficeLocation, Vertical, Department } = require('../../database/models');

    // Check if it's an organisation → return office locations
    let node = await Organisation.findByPk(id);
    if (node) {
      return OfficeLocation.findAll({ where: { organisation_id: id, deleted_at: null } });
    }

    // Check if it's an office location → return verticals
    node = await OfficeLocation.findOne({ where: { id, deleted_at: null } });
    if (node) {
      return Vertical.findAll({ where: { office_location_id: id, deleted_at: null } });
    }

    // Check if it's a vertical → return departments
    node = await Vertical.findOne({ where: { id, deleted_at: null } });
    if (node) {
      return Department.findAll({ where: { vertical_id: id, deleted_at: null } });
    }

    // Departments have no children
    node = await Department.findOne({ where: { id, deleted_at: null } });
    if (node) return [];

    throw ApiError.notFound('Org node not found');
  },

  async getSubtree(id) {
    const { Organisation, OfficeLocation, Vertical, Department } = require('../../database/models');

    // Check if it's an organisation → full tree
    let node = await Organisation.findByPk(id);
    if (node) return hierarchyService.getFullTree(id);

    // Check if it's an office location → return with nested verticals/departments
    node = await OfficeLocation.findOne({
      where: { id, deleted_at: null },
      include: [{
        model: Vertical, as: 'verticals', where: { deleted_at: null }, required: false,
        include: [{ model: Department, as: 'departments', where: { deleted_at: null }, required: false }],
      }],
    });
    if (node) return node;

    // Check if it's a vertical → return with nested departments
    node = await Vertical.findOne({
      where: { id, deleted_at: null },
      include: [{ model: Department, as: 'departments', where: { deleted_at: null }, required: false }],
    });
    if (node) return node;

    // Department → leaf node
    node = await Department.findOne({ where: { id, deleted_at: null } });
    if (node) return node;

    throw ApiError.notFound('Org node not found');
  },

  // ── Office Locations ──

  async getOfficeLocation(id) {
    const { OfficeLocation } = require('../../database/models');
    const office = await OfficeLocation.findByPk(id);
    if (!office) throw ApiError.notFound('Office location not found');
    return office;
  },

  async createOfficeLocation(data, userId) {
    const { sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();
    try {
      const office = await hierarchyService.createOfficeLocation({
        organisation_id: DEFAULT_ORGANISATION_ID,
        name: data.name,
        code: data.code || null,
        address: data.address || null,
        city: data.city || null,
        country: data.country || null,
        timezone: data.timezone || null,
      }, transaction);

      await auditService.log({
        user_id: userId,
        action: 'ORG_UNIT_CREATED',
        resource_type: 'OfficeLocation',
        resource_id: office.id,
        details: { name: data.name },
      });

      await transaction.commit();
      await cacheService.deletePattern('bh:org:tree:*');
      return office;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateOfficeLocation(id, data) {
    const { OfficeLocation } = require('../../database/models');
    const office = await OfficeLocation.findByPk(id);
    if (!office) throw ApiError.notFound('Office location not found');

    const allowedFields = ['name', 'code', 'status', 'sort_order', 'address', 'city', 'country', 'timezone'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    await office.update(updates);
    await cacheService.deletePattern('bh:org:tree:*');
    return office;
  },

  async deleteOfficeLocation(id, userId) {
    const { OfficeLocation, Vertical } = require('../../database/models');
    const office = await OfficeLocation.findByPk(id);
    if (!office) throw ApiError.notFound('Office location not found');

    const children = await Vertical.findAll({ where: { office_location_id: id, deleted_at: null } });
    if (children.length > 0) {
      throw ApiError.conflict('Cannot delete office with verticals. Remove verticals first.');
    }

    await office.update({ deleted_at: new Date() });
    await auditService.log({
      user_id: userId, action: 'ORG_UNIT_DELETED', resource_type: 'OfficeLocation',
      resource_id: id, details: { name: office.name },
    });
    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Office location deleted successfully' };
  },

  // ── Verticals ──

  async getVertical(id) {
    const { Vertical } = require('../../database/models');
    const vertical = await Vertical.findByPk(id);
    if (!vertical) throw ApiError.notFound('Vertical not found');
    return vertical;
  },

  async createVertical(data, userId) {
    const { sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();
    try {
      const vertical = await hierarchyService.createVertical({
        office_location_id: data.office_location_id,
        name: data.name,
        code: data.code || null,
      }, transaction);

      await auditService.log({
        user_id: userId, action: 'ORG_UNIT_CREATED', resource_type: 'Vertical',
        resource_id: vertical.id, details: { name: data.name },
      });

      await transaction.commit();
      await cacheService.deletePattern('bh:org:tree:*');
      return vertical;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateVertical(id, data) {
    const { Vertical } = require('../../database/models');
    const vertical = await Vertical.findByPk(id);
    if (!vertical) throw ApiError.notFound('Vertical not found');

    const allowedFields = ['name', 'code', 'status', 'sort_order'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    await vertical.update(updates);
    await cacheService.deletePattern('bh:org:tree:*');
    return vertical;
  },

  async deleteVertical(id, userId) {
    const { Vertical, Department } = require('../../database/models');
    const vertical = await Vertical.findByPk(id);
    if (!vertical) throw ApiError.notFound('Vertical not found');

    const children = await Department.findAll({ where: { vertical_id: id, deleted_at: null } });
    if (children.length > 0) {
      throw ApiError.conflict('Cannot delete vertical with departments. Remove departments first.');
    }

    await vertical.update({ deleted_at: new Date() });
    await auditService.log({
      user_id: userId, action: 'ORG_UNIT_DELETED', resource_type: 'Vertical',
      resource_id: id, details: { name: vertical.name },
    });
    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Vertical deleted successfully' };
  },

  // ── Departments ──

  async getDepartment(id) {
    const { Department } = require('../../database/models');
    const department = await Department.findByPk(id);
    if (!department) throw ApiError.notFound('Department not found');
    return department;
  },

  async createDepartment(data, userId) {
    const { sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();
    try {
      const department = await hierarchyService.createDepartment({
        vertical_id: data.vertical_id,
        name: data.name,
        code: data.code || null,
      }, transaction);

      await auditService.log({
        user_id: userId, action: 'ORG_UNIT_CREATED', resource_type: 'Department',
        resource_id: department.id, details: { name: data.name },
      });

      await transaction.commit();
      await cacheService.deletePattern('bh:org:tree:*');
      return department;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateDepartment(id, data) {
    const { Department } = require('../../database/models');
    const department = await Department.findByPk(id);
    if (!department) throw ApiError.notFound('Department not found');

    const allowedFields = ['name', 'code', 'status', 'sort_order'];
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    await department.update(updates);
    await cacheService.deletePattern('bh:org:tree:*');
    return department;
  },

  async deleteDepartment(id, userId) {
    const { Department } = require('../../database/models');
    const department = await Department.findByPk(id);
    if (!department) throw ApiError.notFound('Department not found');

    await department.update({ deleted_at: new Date() });
    await auditService.log({
      user_id: userId, action: 'ORG_UNIT_DELETED', resource_type: 'Department',
      resource_id: id, details: { name: department.name },
    });
    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Department deleted successfully' };
  },
};

module.exports = orgService;
