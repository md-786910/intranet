const bcrypt = require('bcryptjs');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const tokenService = require('../../services/token.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

function buildDepartmentPath(department) {
  if (!department) return null;

  const parts = [
    department.name,
    department.vertical?.name,
    department.vertical?.officeLocation?.name,
    department.vertical?.officeLocation?.organisation?.name,
  ].filter(Boolean);

  return parts.join(' · ');
}

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
    const {
      UserAccount,
      PersonProfile,
      UserRoleAssignment,
      Role,
      DepartmentMembership,
      Department,
      Vertical,
      OfficeLocation,
      Organisation,
      UserPermission,
      ModuleAction,
      Module,
    } = require('../../database/models');

    const user = await UserAccount.findByPk(id, {
      attributes: { exclude: ['password_hash'] },
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: UserRoleAssignment,
          as: 'roleAssignments',
          include: [
            { model: Role, as: 'role', attributes: ['role_id', 'name', 'code', 'is_system'] },
          ],
        },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          include: [
            {
              model: Department,
              as: 'department',
              attributes: ['id', 'name', 'code'],
              include: [
                {
                  model: Vertical,
                  as: 'vertical',
                  attributes: ['id', 'name'],
                  include: [
                    {
                      model: OfficeLocation,
                      as: 'officeLocation',
                      attributes: ['id', 'name'],
                      include: [
                        {
                          model: Organisation,
                          as: 'organisation',
                          attributes: ['id', 'name'],
                        },
                      ],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          model: UserPermission,
          as: 'directPermissions',
          include: [{
            model: ModuleAction,
            as: 'moduleAction',
            attributes: ['module_action_id', 'action_code', 'name'],
            include: [{
              model: Module,
              as: 'module',
              attributes: ['module_id', 'code', 'name'],
            }],
          }],
        },
      ],
    });

    if (!user) throw ApiError.notFound('User not found');

    const scopedDepartmentIds = new Set();

    (user.roleAssignments || []).forEach((assignment) => {
      if (assignment.scope_type === 'DEPARTMENT' && assignment.scope_id) {
        scopedDepartmentIds.add(Number(assignment.scope_id));
      }
    });

    (user.directPermissions || []).forEach((permission) => {
      if (permission.scope_type === 'DEPARTMENT' && permission.scope_id) {
        scopedDepartmentIds.add(Number(permission.scope_id));
      }
    });

    const existingMemberships = (user.departmentMemberships || []).map((membership) => ({
      ...membership.toJSON(),
      department_id: membership.department_id,
      path: buildDepartmentPath(membership.department),
      source: membership.is_primary ? 'Primary membership' : 'Membership',
    }));

    const existingDepartmentIds = new Set(existingMemberships.map((membership) => Number(membership.department_id)));
    const derivedDepartmentIds = [...scopedDepartmentIds].filter((departmentId) => !existingDepartmentIds.has(departmentId));

    if (derivedDepartmentIds.length > 0) {
      const derivedDepartments = await Department.findAll({
        where: { id: derivedDepartmentIds },
        include: [
          {
            model: Vertical,
            as: 'vertical',
            attributes: ['id', 'name'],
            include: [
              {
                model: OfficeLocation,
                as: 'officeLocation',
                attributes: ['id', 'name'],
                include: [
                  {
                    model: Organisation,
                    as: 'organisation',
                    attributes: ['id', 'name'],
                  },
                ],
              },
            ],
          },
        ],
        order: [['name', 'ASC']],
      });

      derivedDepartments.forEach((department) => {
        existingMemberships.push({
          membership_id: `derived-${department.id}`,
          department_id: department.id,
          is_primary: false,
          joined_at: null,
          source: 'Inherited from scoped assignment',
          department: department.toJSON(),
          path: buildDepartmentPath(department),
        });
      });
    }

    const userData = user.toJSON();
    userData.departmentMemberships = existingMemberships;
    return userData;
  },

  async create(data, actorUserId) {
    const {
      UserAccount,
      PersonProfile,
      UserRoleAssignment,
      UserPermission,
      DepartmentMembership,
      sequelize,
    } = require('../../database/models');
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

      // Create initial role assignment(s) if provided
      const rolesToAssign = data.initial_roles
        || (data.initial_role ? [data.initial_role] : []);

      for (const role of rolesToAssign) {
        await UserRoleAssignment.create({
          user_id: user.user_id,
          role_id: role.role_id,
          scope_type: role.scope_type || 'ORGANISATION',
          scope_id: role.scope_id,
          assigned_by: actorUserId,
        }, { transaction });
      }

      const initialDepartmentIds = [
        ...new Set(
          rolesToAssign
            .filter((role) => role.scope_type === 'DEPARTMENT' && role.scope_id)
            .map((role) => Number(role.scope_id))
            .concat(
              (data.initial_permissions || [])
                .filter((permission) => permission.scope_type === 'DEPARTMENT' && permission.scope_id)
                .map((permission) => Number(permission.scope_id))
            )
        ),
      ];

      for (const departmentId of initialDepartmentIds) {
        await DepartmentMembership.findOrCreate({
          where: { user_id: user.user_id, department_id: departmentId },
          defaults: { user_id: user.user_id, department_id: departmentId, is_primary: false },
          transaction,
        });
      }

      // Create initial direct permissions if provided
      if (data.initial_permissions && data.initial_permissions.length > 0) {
        for (const perm of data.initial_permissions) {
          await UserPermission.create({
            user_id: user.user_id,
            module_action_id: perm.module_action_id,
            effect: 'ALLOW',
            scope_type: perm.scope_type || 'ORGANISATION',
            scope_id: perm.scope_id,
            assigned_by: actorUserId,
          }, { transaction });
        }
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
    const { UserRoleAssignment, DepartmentMembership } = require('../../database/models');

    // Check for duplicate
    const existing = await UserRoleAssignment.findOne({
      where: {
        user_id: userId,
        role_id: data.role_id,
        scope_type: data.scope_type || 'ORGANISATION',
        scope_id: data.scope_id,
      },
    });
    if (existing) throw ApiError.conflict('Role already assigned at this scope');

    const assignment = await UserRoleAssignment.create({
      user_id: userId,
      role_id: data.role_id,
      scope_type: data.scope_type || 'ORGANISATION',
      scope_id: data.scope_id,
      assigned_by: actorUserId,
      starts_at: data.starts_at || null,
      ends_at: data.ends_at || null,
    });

    if (data.scope_type === 'DEPARTMENT' && data.scope_id) {
      await DepartmentMembership.findOrCreate({
        where: { user_id: userId, department_id: Number(data.scope_id) },
        defaults: {
          user_id: userId,
          department_id: Number(data.scope_id),
          is_primary: false,
        },
      });
    }

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
    if (Number(assignment.user_id) !== Number(userId)) throw ApiError.badRequest('Assignment does not belong to this user');

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

  async assignDirectPermission(userId, data, actorUserId) {
    const { UserPermission } = require('../../database/models');

    const existing = await UserPermission.findOne({
      where: {
        user_id: userId,
        module_action_id: data.module_action_id,
        scope_type: data.scope_type,
        scope_id: data.scope_id,
      },
    });
    if (existing) throw ApiError.conflict('Permission already assigned at this scope');

    const permission = await UserPermission.create({
      user_id: userId,
      module_action_id: data.module_action_id,
      effect: 'ALLOW',
      scope_type: data.scope_type,
      scope_id: data.scope_id,
      assigned_by: actorUserId,
    });

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'PERMISSION_ASSIGNED',
      resource_type: 'UserPermission',
      resource_id: permission.user_permission_id,
      details: { target_user_id: userId, module_action_id: data.module_action_id },
    });

    return permission;
  },

  async removeDirectPermission(userId, permissionId, actorUserId) {
    const { UserPermission } = require('../../database/models');

    const permission = await UserPermission.findByPk(permissionId);
    if (!permission) throw ApiError.notFound('Permission not found');
    if (Number(permission.user_id) !== Number(userId)) throw ApiError.badRequest('Permission does not belong to this user');

    await permission.destroy();

    await cacheService.deletePattern(`bh:perm:${userId}:*`);
    await cacheService.deletePattern(`bh:perms:${userId}:*`);

    await auditService.log({
      user_id: actorUserId,
      action: 'PERMISSION_REMOVED',
      resource_type: 'UserPermission',
      resource_id: permissionId,
      details: { target_user_id: userId },
    });

    return { message: 'Permission removed successfully' };
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
          scope_type: rows[i].scope_type || 'ORGANISATION',
          scope_id: rows[i].scope_id,
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
