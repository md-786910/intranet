const hierarchyService = require('../../services/hierarchy.service');
const organisationContextService = require('../../services/organisation-context.service');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const chatBlockService = require('../../services/chat-block.service');
const ApiError = require('../../utils/ApiError');

const orgService = {
  async getFullTree() {
    const organisationId = await organisationContextService.getCurrentOrganisationId();
    return hierarchyService.getFullTree(organisationId);
  },

  async getNodeById(id) {
    const { OrgNode } = require('../../database/models');
    const node = await OrgNode.findByPk(id);
    if (!node) throw ApiError.notFound('Org node not found');
    return node;
  },

  async getChildren(id) {
    const { OrgNode } = require('../../database/models');
    const node = await OrgNode.findByPk(id);
    if (!node) throw ApiError.notFound('Org node not found');
    return OrgNode.findAll({ where: { parent_id: id }, order: [['sort_order', 'ASC'], ['id', 'ASC']] });
  },

  async getSubtree(id) {
    const { Op } = require('sequelize');
    const { OrgNode } = require('../../database/models');
    const node = await OrgNode.findByPk(id);
    if (!node) throw ApiError.notFound('Org node not found');

    // Everything whose materialized path starts with this node's path.
    const rows = await OrgNode.findAll({
      where: { path: { [Op.like]: `${node.path}%` } },
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });

    const byId = new Map();
    rows.forEach((n) => { const p = n.toJSON(); p.children = []; byId.set(Number(n.id), p); });
    let root = null;
    byId.forEach((n) => {
      if (Number(n.id) === Number(id)) { root = n; return; }
      const parent = byId.get(Number(n.parent_id));
      if (parent) parent.children.push(n);
    });
    return root;
  },

  // ── Generic node CRUD (operational + administrative) ──

  async createNode(data, userId) {
    const { sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();
    try {
      const organisationId = await organisationContextService.getCurrentOrganisationId();
      const node = await hierarchyService.createNode({
        organisation_id: organisationId,
        parent_id: data.parent_id,
        node_type: data.node_type,
        kind: data.kind,
        name: data.name,
        code: data.code,
        address: data.address,
        city: data.city,
        country: data.country,
        timezone: data.timezone,
        sort_order: data.sort_order,
      }, transaction);

      await auditService.log({
        user_id: userId,
        action: 'ORG_UNIT_CREATED',
        resource_type: 'OrgNode',
        resource_id: node.id,
        details: { name: data.name, node_type: data.node_type },
      });

      await transaction.commit();
      await cacheService.deletePattern('bh:org:tree:*');
      organisationContextService.invalidateCache();
      return node;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async updateNode(id, data) {
    const { OrgNode } = require('../../database/models');
    const node = await OrgNode.findByPk(id);
    if (!node) throw ApiError.notFound('Org node not found');

    const allowedFields = ['name', 'code', 'status', 'sort_order'];
    if (node.node_type === 'OFFICE_LOCATION') {
      allowedFields.push('address', 'city', 'country', 'timezone');
    }
    const updates = {};
    allowedFields.forEach((field) => {
      if (data[field] !== undefined) updates[field] = data[field];
    });

    await node.update(updates);
    await cacheService.deletePattern('bh:org:tree:*');
    return node;
  },

  async deleteNode(id, userId) {
    const { OrgNode, NodeMembership } = require('../../database/models');
    const node = await OrgNode.findByPk(id);
    if (!node) throw ApiError.notFound('Org node not found');
    if (node.node_type === 'GROUP') throw ApiError.badRequest('The root group cannot be deleted');

    const childCount = await OrgNode.count({ where: { parent_id: id } });
    if (childCount > 0) {
      throw ApiError.conflict('Cannot delete a node that still has children. Remove them first.');
    }
    const memberCount = await NodeMembership.count({ where: { node_id: id } });
    if (memberCount > 0) {
      throw ApiError.conflict('Cannot delete a node that still has members. Remove them first.');
    }

    await node.update({ deleted_at: new Date() });
    await auditService.log({
      user_id: userId, action: 'ORG_UNIT_DELETED', resource_type: 'OrgNode',
      resource_id: id, details: { name: node.name, node_type: node.node_type },
    });
    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Node deleted successfully' };
  },

  // ── Node membership (attach/detach people at any member-bearing node) ──

  async addNodeMember(nodeId, { user_id, is_primary = false }) {
    const { MEMBER_BEARING_NODE_TYPES } = require('../../utils/constants');
    const { OrgNode, NodeMembership, UserAccount } = require('../../database/models');

    const node = await OrgNode.findByPk(nodeId);
    if (!node) throw ApiError.notFound('Org node not found');
    if (!MEMBER_BEARING_NODE_TYPES.includes(node.node_type)) {
      throw ApiError.badRequest(`Members cannot be attached to a ${node.node_type}`);
    }
    const user = await UserAccount.findByPk(user_id);
    if (!user) throw ApiError.notFound('User not found');

    const [membership] = await NodeMembership.findOrCreate({
      where: { user_id, node_id: nodeId },
      defaults: { user_id, node_id: nodeId, is_primary },
    });
    if (is_primary && !membership.is_primary) {
      await membership.update({ is_primary: true });
    }
    await cacheService.deletePattern('bh:org:tree:*');
    return membership;
  },

  async removeNodeMember(nodeId, userId) {
    const { NodeMembership } = require('../../database/models');
    const deleted = await NodeMembership.destroy({ where: { node_id: nodeId, user_id: userId } });
    if (!deleted) throw ApiError.notFound('Membership not found');
    await cacheService.deletePattern('bh:org:tree:*');
    return { message: 'Member removed' };
  },

  /**
   * Members for a node, nested under the org subtree so the sidebar can show
   * people in their correct structural hierarchy with basic profile info.
   */
  async listNodeMembers(nodeId) {
    const { Op } = require('sequelize');
    const {
      OrgNode, NodeMembership, UserAccount, PersonProfile, UserRoleAssignment, Role,
    } = require('../../database/models');

    const node = await OrgNode.findByPk(nodeId);
    if (!node) throw ApiError.notFound('Org node not found');

    const subtreeNodes = await OrgNode.findAll({
      where: { path: { [Op.like]: `${node.path}%` } },
      attributes: ['id', 'parent_id', 'name', 'node_type', 'code', 'path', 'sort_order'],
      order: [['sort_order', 'ASC'], ['id', 'ASC']],
    });
    const nodeIds = subtreeNodes.map((n) => n.id);
    if (nodeIds.length === 0) {
      return {
        node: { id: node.id, name: node.name, node_type: node.node_type, code: node.code },
        total: 0,
        members: [],
        children: [],
      };
    }

    const memberships = await NodeMembership.findAll({
      where: { node_id: { [Op.in]: nodeIds } },
      include: [{
        model: UserAccount,
        as: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url', 'status', 'deleted_at'],
        where: { deleted_at: null },
        required: true,
        include: [
          {
            model: PersonProfile,
            as: 'profile',
            attributes: ['job_title', 'employee_id', 'reports_to_user_id'],
            required: false,
            include: [{
              model: UserAccount,
              as: 'manager',
              attributes: ['user_id', 'first_name', 'last_name'],
              required: false,
            }],
          },
          {
            model: UserRoleAssignment,
            as: 'roleAssignments',
            attributes: ['assignment_id', 'role_id'],
            required: false,
            include: [{
              model: Role,
              as: 'role',
              attributes: ['role_id', 'code', 'name'],
              required: false,
            }],
          },
        ],
      }],
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC'], ['membership_id', 'ASC']],
    });

    const ROLE_PRIORITY = {
      OWNER: 0,
      OFFICE_MANAGER: 1,
      CONTENT_EDITOR: 2,
      EMPLOYEE: 9,
    };

    const pickPrimaryRole = (roles) => {
      if (!roles.length) return null;
      return [...roles].sort((a, b) => {
        const pa = ROLE_PRIORITY[a.code] ?? 5;
        const pb = ROLE_PRIORITY[b.code] ?? 5;
        if (pa !== pb) return pa - pb;
        return String(a.name || '').localeCompare(String(b.name || ''));
      })[0];
    };

    const mapMember = (m) => {
      const u = m.user;
      const profile = u?.profile;
      const manager = profile?.manager;
      const roles = (u.roleAssignments || [])
        .map((a) => a.role)
        .filter(Boolean);
      // De-dupe by code
      const uniqueRoles = [];
      const seen = new Set();
      roles.forEach((r) => {
        if (!r.code || seen.has(r.code)) return;
        seen.add(r.code);
        uniqueRoles.push(r);
      });
      const primaryRole = pickPrimaryRole(uniqueRoles);
      return {
        membership_id: m.membership_id,
        user_id: u.user_id,
        is_primary: !!m.is_primary,
        first_name: u.first_name,
        last_name: u.last_name,
        email: u.email,
        avatar_url: u.avatar_url || null,
        status: u.status,
        job_title: profile?.job_title || null,
        employee_id: profile?.employee_id || null,
        role_code: primaryRole?.code || null,
        role_label: primaryRole?.name || 'Other',
        roles: uniqueRoles.map((r) => ({ code: r.code, name: r.name })),
        manager: manager
          ? { user_id: manager.user_id, first_name: manager.first_name, last_name: manager.last_name }
          : null,
      };
    };

    const membersByNode = new Map();
    memberships.forEach((m) => {
      const id = Number(m.node_id);
      if (!membersByNode.has(id)) membersByNode.set(id, []);
      membersByNode.get(id).push(mapMember(m));
    });

    const byId = new Map();
    subtreeNodes.forEach((n) => {
      byId.set(Number(n.id), {
        id: n.id,
        parent_id: n.parent_id,
        name: n.name,
        node_type: n.node_type,
        code: n.code,
        members: membersByNode.get(Number(n.id)) || [],
        children: [],
      });
    });

    let root = byId.get(Number(nodeId));
    byId.forEach((n) => {
      if (Number(n.id) === Number(nodeId)) return;
      const parent = byId.get(Number(n.parent_id));
      if (parent) parent.children.push(n);
    });

    // Drop empty branches so the sidebar stays concise.
    const prune = (n) => {
      const children = n.children.map(prune).filter(Boolean);
      const next = {
        id: n.id,
        name: n.name,
        node_type: n.node_type,
        code: n.code,
        members: n.members,
        children,
      };
      if (next.members.length === 0 && next.children.length === 0 && Number(n.id) !== Number(nodeId)) {
        return null;
      }
      return next;
    };
    root = prune(root) || {
      id: node.id,
      name: node.name,
      node_type: node.node_type,
      code: node.code,
      members: [],
      children: [],
    };

    const countAll = (n) => n.members.length + n.children.reduce((s, c) => s + countAll(c), 0);

    return {
      node: { id: node.id, name: node.name, node_type: node.node_type, code: node.code },
      total: countAll(root),
      members: root.members,
      children: root.children,
    };
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
    const visibilityConfig = require('../../config/visibility.config');

    const ALLOWED_LEVELS = new Set(['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT']);
    const keyContactsLevel = ALLOWED_LEVELS.has(visibilityConfig.keyContacts?.level)
      ? visibilityConfig.keyContacts.level
      : 'DEPARTMENT';
    const homeOrgChartLevel = ALLOWED_LEVELS.has(visibilityConfig.homeOrgChart?.level)
      ? visibilityConfig.homeOrgChart.level
      : 'VERTICAL';

    const empty = {
      vertical: null,
      departments: [],
      people: [],
      peopleScope: keyContactsLevel,
      departmentsScope: homeOrgChartLevel,
    };

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

    // Resolve which departments to show in the home page "Organisation Chart"
    // widget, based on visibilityConfig.homeOrgChart.level.
    let departmentsWhere;
    if (homeOrgChartLevel === 'DEPARTMENT') {
      departmentsWhere = { id: membership.department.id, deleted_at: null };
    } else if (homeOrgChartLevel === 'OFFICE_LOCATION' && vertical.officeLocation?.id) {
      const verticalsInOffice = await Vertical.findAll({
        where: { office_location_id: vertical.officeLocation.id, deleted_at: null },
        attributes: ['id'],
      });
      const verticalIds = verticalsInOffice.map((v) => v.id);
      departmentsWhere = { vertical_id: verticalIds, deleted_at: null };
    } else if (homeOrgChartLevel === 'ORGANISATION') {
      departmentsWhere = { deleted_at: null };
    } else {
      // VERTICAL (default fallback) — sibling departments under the user's vertical
      departmentsWhere = { vertical_id: vertical.id, deleted_at: null };
    }

    const siblingDepartments = await Department.findAll({
      where: departmentsWhere,
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
      include: [{
        model: Vertical,
        as: 'vertical',
        attributes: ['id', 'name'],
        required: false,
        include: [{
          model: OfficeLocation,
          as: 'officeLocation',
          attributes: ['id', 'name'],
          required: false,
        }],
      }],
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

    const departments = siblingDepartments.map((d) => {
      const dvertical = d.vertical;
      const office = dvertical?.officeLocation;
      return {
        id: d.id,
        name: d.name,
        memberCount: countsByDept.get(Number(d.id)) || 0,
        verticalName: dvertical?.name || null,
        officeLocationName: office?.name || null,
      };
    });

    // Resolve the department-id pool the "Key Contacts" people are drawn from,
    // based on visibilityConfig.keyContacts.level. DEPARTMENT (default) keeps
    // it tight to the user's own department(s); broader levels fan out.
    let peopleDeptIds = deptIds; // VERTICAL — sibling departments (existing default)
    if (keyContactsLevel === 'DEPARTMENT') {
      const myMemberships = await DepartmentMembership.findAll({
        where: { user_id: userId },
        attributes: ['department_id'],
      });
      peopleDeptIds = [...new Set(myMemberships.map((m) => Number(m.department_id)))];
    } else if (keyContactsLevel === 'OFFICE_LOCATION' && vertical.officeLocation?.id) {
      const verticalsInOffice = await Vertical.findAll({
        where: { office_location_id: vertical.officeLocation.id, deleted_at: null },
        attributes: ['id'],
      });
      const verticalIds = verticalsInOffice.map((v) => v.id);
      const deptsInOffice = verticalIds.length === 0 ? [] : await Department.findAll({
        where: { vertical_id: verticalIds, deleted_at: null },
        attributes: ['id'],
      });
      peopleDeptIds = deptsInOffice.map((d) => Number(d.id));
    } else if (keyContactsLevel === 'ORGANISATION') {
      const allDepts = await Department.findAll({
        where: { deleted_at: null },
        attributes: ['id'],
      });
      peopleDeptIds = allDepts.map((d) => Number(d.id));
    }

    // Resolve the viewer's admin-configured chat blocklist. Used below to
    // surface a `canChat` flag per person — the row still renders (so the
    // employee sees who's in their org), but the Chat button is suppressed
    // client-side when they aren't allowed to message that person.
    const blockedIdSet = await chatBlockService.getBlockedIdSet(userId);

    const peopleRows = peopleDeptIds.length === 0 ? [] : await UserAccount.findAll({
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
          where: { department_id: peopleDeptIds },
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
        canChat: !blockedIdSet.has(Number(u.user_id)),
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
      peopleScope: keyContactsLevel,
      departmentsScope: homeOrgChartLevel,
    };
  },

  /**
   * Returns the user's org hierarchy for Settings.
   * Prefer flexible OrgNode path via node_membership; fall back to legacy
   * department_membership → Vertical → Office → Organisation.
   *
   * Response always includes `path` (root → membership node) for the UI.
   * Legacy-shaped fields are derived for older consumers.
   */
  async getMyHierarchy(userId) {
    const {
      NodeMembership, OrgNode, Organisation,
      DepartmentMembership, Department, Vertical, OfficeLocation,
    } = require('../../database/models');

    const empty = () => ({
      path: [],
      memberships: [],
      organisation: null,
      officeLocation: null,
      vertical: null,
      departments: [],
    });

    const pathNode = (n) => ({
      id: n.id,
      name: n.name,
      node_type: n.node_type,
    });

    const deriveLegacyFromPath = (path, membershipsPayload) => {
      const company = path.find((n) => n.node_type === 'COMPANY');
      const group = path.find((n) => n.node_type === 'GROUP');
      const office = path.find((n) => n.node_type === 'OFFICE_LOCATION');
      const vertical = path.find((n) => n.node_type === 'VERTICAL');
      const orgNode = company || group || null;
      return {
        organisation: orgNode ? { id: orgNode.id, name: orgNode.name } : null,
        officeLocation: office ? { id: office.id, name: office.name } : null,
        vertical: vertical ? { id: vertical.id, name: vertical.name } : null,
        departments: membershipsPayload.filter((m) => (
          m.node_type === 'DEPARTMENT' || m.node_type === 'ADMIN_UNIT'
        )).map((m) => ({
          id: m.id,
          name: m.name,
          isPrimary: !!m.isPrimary,
          verticalId: vertical?.id || null,
          verticalName: vertical?.name || null,
        })),
      };
    };

    const buildAncestorPath = async (leafNode) => {
      if (!leafNode) return [];

      // path format: "1/5/12/" → include every ancestor id plus leaf
      const idsFromPath = String(leafNode.path || '')
        .split('/')
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n > 0);

      const ids = idsFromPath.length > 0
        ? idsFromPath
        : [Number(leafNode.id)];

      const nodes = await OrgNode.findAll({
        where: { id: ids },
        attributes: ['id', 'name', 'node_type', 'parent_id', 'organisation_id', 'path'],
      });
      const byId = new Map(nodes.map((n) => [Number(n.id), n]));

      // Prefer path order; fall back to parent walk if path incomplete
      const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
      if (ordered.length > 0) return ordered.map(pathNode);

      const chain = [];
      let current = leafNode;
      const seen = new Set();
      while (current && !seen.has(Number(current.id))) {
        seen.add(Number(current.id));
        chain.push(pathNode(current));
        if (!current.parent_id) break;
        // eslint-disable-next-line no-await-in-loop
        current = byId.get(Number(current.parent_id))
          || await OrgNode.findByPk(current.parent_id, {
            attributes: ['id', 'name', 'node_type', 'parent_id', 'organisation_id', 'path'],
          });
      }
      return chain.reverse();
    };

    // ── Primary: node_membership ──
    const nodeMemberships = await NodeMembership.findAll({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC'], ['membership_id', 'ASC']],
      include: [{
        model: OrgNode,
        as: 'node',
        required: true,
        attributes: ['id', 'name', 'node_type', 'parent_id', 'organisation_id', 'path'],
      }],
    });

    if (nodeMemberships.length > 0) {
      const membershipsPayload = nodeMemberships.map((m) => ({
        id: m.node.id,
        name: m.node.name,
        node_type: m.node.node_type,
        isPrimary: !!m.is_primary,
      }));

      const primary = nodeMemberships[0];
      const path = await buildAncestorPath(primary.node);
      const legacy = deriveLegacyFromPath(path, membershipsPayload);

      return {
        path,
        memberships: membershipsPayload,
        ...legacy,
      };
    }

    // ── Fallback: legacy department_membership ──
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
      return empty();
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

    const path = [
      organisation && { id: organisation.id, name: organisation.name, node_type: 'COMPANY' },
      officeLocation && { id: officeLocation.id, name: officeLocation.name, node_type: 'OFFICE_LOCATION' },
      vertical && { id: vertical.id, name: vertical.name, node_type: 'VERTICAL' },
      primary.department && {
        id: primary.department.id,
        name: primary.department.name,
        node_type: 'DEPARTMENT',
      },
    ].filter(Boolean);

    return {
      path,
      memberships: departments.map((d) => ({
        id: d.id,
        name: d.name,
        node_type: 'DEPARTMENT',
        isPrimary: d.isPrimary,
      })),
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
         AND EXISTS (SELECT 1 FROM department_membership dm WHERE dm.user_id = ua.user_id)
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
