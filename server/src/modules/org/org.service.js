const hierarchyService = require('../../services/hierarchy.service');
const organisationContextService = require('../../services/organisation-context.service');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const ApiError = require('../../utils/ApiError');

const orgService = {
  async getFullTree() {
    const organisationId = await organisationContextService.getCurrentOrganisationId();
    return hierarchyService.getFullTree(organisationId);
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
      const organisationId = await organisationContextService.getCurrentOrganisationId();
      const office = await hierarchyService.createOfficeLocation({
        organisation_id: organisationId,
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
      organisationContextService.invalidateCache();
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

  // ── My Vertical (logged-in user's organisational neighbourhood) ──

  async getMyVertical(userId, { peopleLimit = 8 } = {}) {
    const { Op, fn, col, literal } = require('sequelize');
    const {
      DepartmentMembership, Department, Vertical, OfficeLocation,
      UserAccount, PersonProfile,
    } = require('../../database/models');

    const empty = { vertical: null, departments: [], people: [] };

    const membership = await DepartmentMembership.findOne({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC']],
      include: [{
        model: Department,
        as: 'department',
        where: { deleted_at: null },
        required: true,
        include: [{
          model: Vertical,
          as: 'vertical',
          where: { deleted_at: null },
          required: true,
          include: [{
            model: OfficeLocation,
            as: 'officeLocation',
            where: { deleted_at: null },
            required: false,
          }],
        }],
      }],
    });

    if (!membership || !membership.department || !membership.department.vertical) {
      return empty;
    }

    const vertical = membership.department.vertical;

    const siblingDepartments = await Department.findAll({
      where: { vertical_id: vertical.id, deleted_at: null },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });

    const deptIds = siblingDepartments.map((d) => d.id);

    let countsByDept = new Map();
    if (deptIds.length > 0) {
      const countRows = await DepartmentMembership.findAll({
        attributes: [
          'department_id',
          [fn('COUNT', literal('DISTINCT "DepartmentMembership"."user_id"')), 'count'],
        ],
        where: { department_id: deptIds },
        include: [{
          model: UserAccount,
          as: 'user',
          attributes: [],
          required: true,
          where: { deleted_at: null, status: 'ACTIVE' },
        }],
        group: ['DepartmentMembership.department_id'],
        raw: true,
      });
      countsByDept = new Map(countRows.map((r) => [Number(r.department_id), Number(r.count)]));
    }

    const departments = siblingDepartments.map((d) => ({
      id: d.id,
      name: d.name,
      memberCount: countsByDept.get(Number(d.id)) || 0,
    }));

    const peopleRows = deptIds.length === 0 ? [] : await UserAccount.findAll({
      where: {
        deleted_at: null,
        status: 'ACTIVE',
        user_id: { [Op.ne]: userId },
      },
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          required: true,
          where: { department_id: deptIds },
          include: [{
            model: Department,
            as: 'department',
            attributes: ['id', 'name'],
            required: true,
          }],
        },
      ],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
      subQuery: false,
      limit: peopleLimit,
    });

    const people = peopleRows.map((u) => {
      const primary = (u.departmentMemberships || []).find((m) => m.is_primary)
        || (u.departmentMemberships || [])[0];
      return {
        userId: u.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        jobTitle: u.profile?.job_title || null,
        avatarUrl: u.avatar_url || null,
        departmentName: primary?.department?.name || null,
      };
    });

    return {
      vertical: {
        id: vertical.id,
        name: vertical.name,
        officeLocation: vertical.officeLocation ? {
          id: vertical.officeLocation.id,
          name: vertical.officeLocation.name,
        } : null,
      },
      departments,
      people,
    };
  },

  /**
   * Returns the user's full org hierarchy chain:
   *   Organisation -> OfficeLocation -> Vertical -> Department(s)
   *
   * The chain follows the user's primary department membership. All
   * department memberships are returned (with isPrimary flag) so that
   * users with multiple memberships under the same vertical see them all.
   */
  async getMyHierarchy(userId) {
    const {
      DepartmentMembership, Department, Vertical, OfficeLocation, Organisation,
    } = require('../../database/models');

    const memberships = await DepartmentMembership.findAll({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC']],
      include: [{
        model: Department,
        as: 'department',
        where: { deleted_at: null },
        required: true,
        include: [{
          model: Vertical,
          as: 'vertical',
          where: { deleted_at: null },
          required: true,
          include: [{
            model: OfficeLocation,
            as: 'officeLocation',
            where: { deleted_at: null },
            required: false,
            include: [{
              model: Organisation,
              as: 'organisation',
              required: false,
            }],
          }],
        }],
      }],
    });

    if (!memberships || memberships.length === 0) {
      return { organisation: null, officeLocation: null, vertical: null, departments: [] };
    }

    const primary = memberships[0];
    const vertical = primary.department.vertical;
    const officeLocation = vertical.officeLocation || null;
    const organisation = officeLocation?.organisation || null;

    const departments = memberships.map((m) => ({
      id: m.department.id,
      name: m.department.name,
      isPrimary: !!m.is_primary,
      verticalId: m.department.vertical?.id || null,
      verticalName: m.department.vertical?.name || null,
    }));

    return {
      organisation: organisation ? { id: organisation.id, name: organisation.name } : null,
      officeLocation: officeLocation ? { id: officeLocation.id, name: officeLocation.name } : null,
      vertical: { id: vertical.id, name: vertical.name },
      departments,
    };
  },

  async getPeopleTree() {
    const { QueryTypes } = require('sequelize');
    const { sequelize, Organisation } = require('../../database/models');

    const organisation = await Organisation.findOne({
      attributes: ['id', 'name'],
      order: [['id', 'ASC']],
    });

    const rows = await sequelize.query(
      `SELECT
         ua.user_id,
         ua.first_name,
         ua.last_name,
         ua.email,
         ua.avatar_url,
         pp.job_title,
         pp.reports_to_user_id,
         rc.id      AS role_category_id,
         rc.name    AS role_category_name,
         rc.rank    AS role_category_rank,
         d.id       AS department_id,
         d.name     AS department_name
       FROM user_account ua
       LEFT JOIN person_profile pp ON pp.user_id = ua.user_id
       LEFT JOIN role_category   rc ON rc.id     = pp.role_category_id
       LEFT JOIN LATERAL (
         SELECT dm.department_id
         FROM department_membership dm
         WHERE dm.user_id = ua.user_id
         ORDER BY dm.is_primary DESC, dm.joined_at ASC NULLS LAST, dm.membership_id ASC
         LIMIT 1
       ) primary_dm ON TRUE
       LEFT JOIN department d ON d.id = primary_dm.department_id
       WHERE ua.deleted_at IS NULL
         AND EXISTS (SELECT 1 FROM employee_invitation ei WHERE ei.user_id = ua.user_id)
       ORDER BY rc.rank NULLS LAST, ua.first_name, ua.last_name`,
      { type: QueryTypes.SELECT },
    );

    const nodes = rows.map((r) => ({
      user_id: r.user_id,
      first_name: r.first_name,
      last_name: r.last_name,
      email: r.email,
      avatar_url: r.avatar_url,
      job_title: r.job_title,
      reports_to_user_id: r.reports_to_user_id,
      role_category: r.role_category_id
        ? { id: r.role_category_id, name: r.role_category_name, rank: r.role_category_rank }
        : null,
      primary_department: r.department_id
        ? { id: r.department_id, name: r.department_name }
        : null,
    }));

    return {
      organisation: organisation ? { id: organisation.id, name: organisation.name } : null,
      nodes,
    };
  },
};

module.exports = orgService;
