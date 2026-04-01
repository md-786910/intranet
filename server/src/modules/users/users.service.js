const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const tokenService = require('../../services/token.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const usersService = {
  async list(query) {
    const { UserAccount, PersonProfile, DepartmentMembership } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);

    const where = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where[Op.or] = [
        { email: { [Op.iLike]: `%${query.search}%` } },
        { first_name: { [Op.iLike]: `%${query.search}%` } },
        { last_name: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const include = [
      { model: PersonProfile, as: 'profile', required: false },
    ];

    // Filter by department if specified
    if (query.department_id) {
      include.push({
        model: DepartmentMembership,
        as: 'departmentMemberships',
        where: { department_id: query.department_id },
        required: true,
      });
    }

    const { rows, count } = await UserAccount.findAndCountAll({
      where,
      limit,
      offset,
      include,
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
      distinct: true,
    });

    return {
      users: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const { UserAccount, PersonProfile, UserRoleAssignment, Role, OrgUnit, DepartmentMembership } = require('../../database/models');

    const user = await UserAccount.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: UserRoleAssignment,
          as: 'roleAssignments',
          include: [
            { model: Role, as: 'role', attributes: ['role_id', 'name', 'code', 'is_system'] },
            { model: OrgUnit, as: 'orgUnit', attributes: ['org_unit_id', 'name', 'node_type', 'path'] },
          ],
        },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          include: [
            { model: OrgUnit, as: 'department', attributes: ['org_unit_id', 'name', 'node_type', 'path'] },
          ],
        },
      ],
    });

    if (!user) throw ApiError.notFound('User not found');
    return user;
  },

  async create(data, actorUserId) {
    const { UserAccount, PersonProfile, UserRoleAssignment, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      // Check email uniqueness
      const existing = await UserAccount.findOne({
        where: { email: data.email.toLowerCase() },
        transaction,
      });
      if (existing) throw ApiError.conflict('Email already in use');

      const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
      const passwordHash = await bcrypt.hash(data.password, rounds);

      const user = await UserAccount.create({
        email: data.email.toLowerCase(),
        password_hash: passwordHash,
        first_name: data.first_name,
        last_name: data.last_name,
        phone: data.phone || null,
        status: 'ACTIVE',
      }, { transaction });

      // Create profile if provided
      if (data.profile) {
        await PersonProfile.create({
          user_id: user.user_id,
          ...data.profile,
        }, { transaction });
      } else {
        await PersonProfile.create({ user_id: user.user_id }, { transaction });
      }

      // Create initial role assignment if provided
      if (data.initial_role) {
        await UserRoleAssignment.create({
          user_id: user.user_id,
          role_id: data.initial_role.role_id,
          org_unit_id: data.initial_role.org_unit_id,
          assigned_by: actorUserId,
        }, { transaction });
      }

      await auditService.log({
        user_id: actorUserId,
        action: 'USER_CREATED',
        resource_type: 'UserAccount',
        resource_id: user.user_id,
        details: { email: user.email },
      });

      await transaction.commit();
      return this.getById(user.user_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, actorUserId) {
    const { UserAccount, PersonProfile, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const user = await UserAccount.findByPk(id, { transaction });
      if (!user) throw ApiError.notFound('User not found');

      // Update user fields
      const userFields = ['first_name', 'last_name', 'phone', 'status'];
      userFields.forEach((field) => {
        if (data[field] !== undefined) user[field] = data[field];
      });
      await user.save({ transaction });

      // Update profile if provided
      if (data.profile) {
        let profile = await PersonProfile.findOne({ where: { user_id: id }, transaction });
        if (profile) {
          await profile.update(data.profile, { transaction });
        } else {
          await PersonProfile.create({ user_id: id, ...data.profile }, { transaction });
        }
      }

      await auditService.log({
        user_id: actorUserId,
        action: 'USER_UPDATED',
        resource_type: 'UserAccount',
        resource_id: id,
      });

      await transaction.commit();
      return this.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async deactivate(id, actorUserId) {
    const { UserAccount } = require('../../database/models');

    const user = await UserAccount.findByPk(id);
    if (!user) throw ApiError.notFound('User not found');

    await user.update({ status: 'INACTIVE', deleted_at: new Date() });

    // Revoke all tokens
    await tokenService.revokeAllUserTokens(id);
    await cacheService.deletePattern(`bh:perm:${id}:*`);
    await cacheService.deletePattern(`bh:perms:${id}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'USER_DEACTIVATED',
      resource_type: 'UserAccount',
      resource_id: id,
    });

    return { message: 'User deactivated successfully' };
  },

  async assignRole(userId, data, actorUserId) {
    const { UserRoleAssignment } = require('../../database/models');

    // Check for duplicate
    const existing = await UserRoleAssignment.findOne({
      where: {
        user_id: userId,
        role_id: data.role_id,
        org_unit_id: data.org_unit_id,
      },
    });
    if (existing) throw ApiError.conflict('Role already assigned at this scope');

    const assignment = await UserRoleAssignment.create({
      user_id: userId,
      role_id: data.role_id,
      org_unit_id: data.org_unit_id,
      assigned_by: actorUserId,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
    });

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'ROLE_ASSIGNED',
      resource_type: 'UserRoleAssignment',
      resource_id: assignment.assignment_id,
      details: { target_user_id: userId, role_id: data.role_id },
    });

    return assignment;
  },

  async unassignRole(userId, assignmentId, actorUserId) {
    const { UserRoleAssignment } = require('../../database/models');

    const assignment = await UserRoleAssignment.findByPk(assignmentId);
    if (!assignment) throw ApiError.notFound('Role assignment not found');
    if (assignment.user_id !== userId) throw ApiError.badRequest('Assignment does not belong to this user');

    await assignment.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'ROLE_UNASSIGNED',
      resource_type: 'UserRoleAssignment',
      resource_id: assignmentId,
      details: { target_user_id: userId },
    });

    return { message: 'Role unassigned successfully' };
  },

  async assignDepartment(userId, data, actorUserId) {
    const { DepartmentMembership, sequelize } = require('../../database/models');

    const existing = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: data.department_id },
    });
    if (existing) throw ApiError.conflict('User already assigned to this department');

    // If setting as primary, unset existing primary
    if (data.is_primary) {
      await DepartmentMembership.update(
        { is_primary: false },
        { where: { user_id: userId, is_primary: true } }
      );
    }

    return DepartmentMembership.create({
      user_id: userId,
      department_id: data.department_id,
      is_primary: data.is_primary || false,
    });
  },

  async removeDepartment(userId, deptId) {
    const { DepartmentMembership } = require('../../database/models');

    const membership = await DepartmentMembership.findOne({
      where: { user_id: userId, department_id: deptId },
    });
    if (!membership) throw ApiError.notFound('Department membership not found');

    await membership.destroy();
    return { message: 'Removed from department successfully' };
  },

  async importCsv(rows, actorUserId) {
    const results = { created: 0, skipped: 0, errors: [] };

    for (let i = 0; i < rows.length; i++) {
      try {
        await this.create({
          ...rows[i],
          org_unit_id: rows[i].org_unit_id,
        }, actorUserId);
        results.created++;
      } catch (error) {
        results.skipped++;
        results.errors.push({ row: i + 1, error: error.message });
      }
    }

    return results;
  },
};

module.exports = usersService;
