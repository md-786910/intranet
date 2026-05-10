const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');

const service = {
  async list() {
    const { RoleCategory } = require('../../database/models');
    return RoleCategory.findAll({
      where: { tenant_id: DEFAULT_TENANT_ID },
      order: [['rank', 'ASC'], ['id', 'ASC']],
    });
  },

  async getById(id) {
    const { RoleCategory } = require('../../database/models');
    const row = await RoleCategory.findOne({
      where: { id, tenant_id: DEFAULT_TENANT_ID },
    });
    if (!row) throw ApiError.notFound('Role category not found');
    return row;
  },

  async create(data) {
    const { RoleCategory, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const nameClash = await RoleCategory.findOne({
        where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
        transaction: tx,
      });
      if (nameClash) throw ApiError.conflict('A role category with this name already exists');

      let rank = data.rank;
      if (!rank) {
        const max = await RoleCategory.max('rank', {
          where: { tenant_id: DEFAULT_TENANT_ID },
          transaction: tx,
        });
        rank = (max || 0) + 1;
      } else {
        const rankClash = await RoleCategory.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, rank },
          transaction: tx,
        });
        if (rankClash) throw ApiError.conflict('Rank is already in use');
      }

      const created = await RoleCategory.create({
        tenant_id: DEFAULT_TENANT_ID,
        name: data.name,
        rank,
        description: data.description || null,
      }, { transaction: tx });

      await tx.commit();
      return created;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async update(id, data) {
    const { RoleCategory, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const row = await RoleCategory.findOne({
        where: { id, tenant_id: DEFAULT_TENANT_ID },
        transaction: tx,
      });
      if (!row) throw ApiError.notFound('Role category not found');

      if (data.name !== undefined && data.name !== row.name) {
        const nameClash = await RoleCategory.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
          transaction: tx,
        });
        if (nameClash) throw ApiError.conflict('A role category with this name already exists');
        row.name = data.name;
      }
      if (data.rank !== undefined && data.rank !== row.rank) {
        const rankClash = await RoleCategory.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, rank: data.rank },
          transaction: tx,
        });
        if (rankClash) throw ApiError.conflict('Rank is already in use');
        row.rank = data.rank;
      }
      if (data.description !== undefined) {
        row.description = data.description || null;
      }

      await row.save({ transaction: tx });
      await tx.commit();
      return row;
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async remove(id) {
    const { RoleCategory, PersonProfile, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const row = await RoleCategory.findOne({
        where: { id, tenant_id: DEFAULT_TENANT_ID },
        transaction: tx,
      });
      if (!row) throw ApiError.notFound('Role category not found');

      const inUse = await PersonProfile.count({
        where: { role_category_id: id },
        transaction: tx,
      });
      if (inUse > 0) {
        throw ApiError.conflict(`Cannot delete — ${inUse} employee${inUse === 1 ? '' : 's'} still use this category`);
      }

      await row.destroy({ transaction: tx });
      await tx.commit();
      return { message: 'Role category deleted' };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async reorder(orderedIds) {
    const { RoleCategory, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const rows = await RoleCategory.findAll({
        where: { tenant_id: DEFAULT_TENANT_ID, id: orderedIds },
        transaction: tx,
      });
      if (rows.length !== orderedIds.length) {
        throw ApiError.badRequest('One or more role category IDs are invalid');
      }

      // Two-phase update to dodge unique(rank) collisions: park them in a high range, then assign final ranks.
      const offset = 1000000;
      for (let i = 0; i < orderedIds.length; i += 1) {
        await RoleCategory.update(
          { rank: offset + i + 1 },
          { where: { id: orderedIds[i], tenant_id: DEFAULT_TENANT_ID }, transaction: tx },
        );
      }
      for (let i = 0; i < orderedIds.length; i += 1) {
        await RoleCategory.update(
          { rank: i + 1 },
          { where: { id: orderedIds[i], tenant_id: DEFAULT_TENANT_ID }, transaction: tx },
        );
      }

      await tx.commit();
      return service.list();
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },
};

module.exports = service;
