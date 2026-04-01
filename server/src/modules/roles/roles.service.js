const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const cacheService = require('../../services/cache.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const rolesService = {
  async list(query) {
    const { Role, RolePermission, ModuleAction, Module } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);

    const where = { tenant_id: DEFAULT_TENANT_ID, deleted_at: null };
    if (query.search) {
      where.name = { [Op.iLike]: `%${query.search}%` };
    }

    const { rows, count } = await Role.findAndCountAll({
      where,
      limit,
      offset,
      order: [['is_system', 'DESC'], ['name', 'ASC']],
      include: [{
        model: RolePermission,
        as: 'permissions',
        attributes: ['role_permission_id', 'module_action_id', 'effect'],
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
      }],
    });

    return {
      roles: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async listModules() {
    const { Module, ModuleAction } = require('../../database/models');

    const modules = await Module.findAll({
      where: { is_active: true },
      include: [{
        model: ModuleAction,
        as: 'actions',
        attributes: ['module_action_id', 'action_code', 'name'],
      }],
      order: [['name', 'ASC']],
    });

    return modules;
  },

  async getById(id) {
    const { Role, RolePermission, ModuleAction, Module } = require('../../database/models');

    const role = await Role.findByPk(id, {
      include: [{
        model: RolePermission,
        as: 'permissions',
        include: [{
          model: ModuleAction,
          as: 'moduleAction',
          include: [{ model: Module, as: 'module', attributes: ['module_id', 'code', 'name'] }],
        }],
      }],
    });

    if (!role) throw ApiError.notFound('Role not found');
    return role;
  },

  async create(data, userId) {
    const { Role, RolePermission, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const role = await Role.create({
        tenant_id: DEFAULT_TENANT_ID,
        code: data.code,
        name: data.name,
        description: data.description || null,
        is_system: false,
        created_by: userId,
      }, { transaction });

      if (data.permissions && data.permissions.length > 0) {
        const permRows = data.permissions.map((p) => ({
          role_id: role.role_id,
          module_action_id: p.module_action_id,
          effect: p.effect || 'ALLOW',
        }));
        await RolePermission.bulkCreate(permRows, { transaction });
      }

      await auditService.log({
        user_id: userId,
        action: 'ROLE_CREATED',
        resource_type: 'Role',
        resource_id: role.role_id,
        details: { name: data.name, code: data.code },
      });

      await transaction.commit();
      return this.getById(role.role_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, userId) {
    const { Role, RolePermission, UserRoleAssignment, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const role = await Role.findByPk(id, { transaction });
      if (!role) throw ApiError.notFound('Role not found');
      if (role.is_system) throw ApiError.forbidden('System roles cannot be modified');

      // Update role fields
      if (data.name !== undefined) role.name = data.name;
      if (data.description !== undefined) role.description = data.description;
      await role.save({ transaction });

      // Sync permissions if provided
      if (data.permissions) {
        await RolePermission.destroy({ where: { role_id: id }, transaction });
        if (data.permissions.length > 0) {
          const permRows = data.permissions.map((p) => ({
            role_id: id,
            module_action_id: p.module_action_id,
            effect: p.effect || 'ALLOW',
          }));
          await RolePermission.bulkCreate(permRows, { transaction });
        }

        // Invalidate cache for affected users
        const assignments = await UserRoleAssignment.findAll({
          where: { role_id: id },
          attributes: ['user_id'],
          transaction,
        });
        for (const a of assignments) {
          await cacheService.deletePattern(`bh:perm:${a.user_id}:*`);
          await cacheService.deletePattern(`bh:perms:${a.user_id}:*`);
        }
      }

      await auditService.log({
        user_id: userId,
        action: 'ROLE_UPDATED',
        resource_type: 'Role',
        resource_id: id,
        details: { name: role.name },
      });

      await transaction.commit();
      return this.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async delete(id, userId) {
    const { Role, UserRoleAssignment } = require('../../database/models');

    const role = await Role.findByPk(id);
    if (!role) throw ApiError.notFound('Role not found');
    if (role.is_system) throw ApiError.forbidden('System roles cannot be deleted');

    // Check for active assignments
    const assignmentCount = await UserRoleAssignment.count({ where: { role_id: id } });
    if (assignmentCount > 0) {
      throw ApiError.conflict(
        `Cannot delete role with ${assignmentCount} active assignment(s). Remove assignments first.`
      );
    }

    await role.update({ deleted_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'ROLE_DELETED',
      resource_type: 'Role',
      resource_id: id,
      details: { name: role.name, code: role.code },
    });

    return { message: 'Role deleted successfully' };
  },

  async clone(id, data, userId) {
    const { Role, RolePermission, sequelize } = require('../../database/models');
    const transaction = await sequelize.transaction();

    try {
      const sourceRole = await Role.findByPk(id, {
        include: [{ model: RolePermission, as: 'permissions' }],
        transaction,
      });
      if (!sourceRole) throw ApiError.notFound('Source role not found');

      const newRole = await Role.create({
        tenant_id: DEFAULT_TENANT_ID,
        code: data.code,
        name: data.name,
        description: sourceRole.description,
        is_system: false,
        created_by: userId,
      }, { transaction });

      if (sourceRole.permissions && sourceRole.permissions.length > 0) {
        const permRows = sourceRole.permissions.map((p) => ({
          role_id: newRole.role_id,
          module_action_id: p.module_action_id,
          effect: p.effect,
        }));
        await RolePermission.bulkCreate(permRows, { transaction });
      }

      await auditService.log({
        user_id: userId,
        action: 'ROLE_CREATED',
        resource_type: 'Role',
        resource_id: newRole.role_id,
        details: { name: data.name, cloned_from: sourceRole.name },
      });

      await transaction.commit();
      return this.getById(newRole.role_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = rolesService;
