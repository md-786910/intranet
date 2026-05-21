const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');

const service = {
  async list() {
    const { JobTitle } = require('../../database/models');
    return JobTitle.findAll({
      where: { tenant_id: DEFAULT_TENANT_ID },
      order: [['rank', 'ASC'], ['id', 'ASC']],
    });
  },

  async getById(id) {
    const { JobTitle } = require('../../database/models');
    const row = await JobTitle.findOne({
      where: { id, tenant_id: DEFAULT_TENANT_ID },
    });
    if (!row) throw ApiError.notFound('Job title not found');
    return row;
  },

  async create(data) {
    const { JobTitle, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const nameClash = await JobTitle.findOne({
        where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
        transaction: tx,
      });
      if (nameClash) throw ApiError.conflict('A job title with this name already exists');

      let rank = data.rank;
      if (!rank) {
        const max = await JobTitle.max('rank', {
          where: { tenant_id: DEFAULT_TENANT_ID },
          transaction: tx,
        });
        rank = (max || 0) + 1;
      } else {
        const rankClash = await JobTitle.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, rank },
          transaction: tx,
        });
        if (rankClash) throw ApiError.conflict('Rank is already in use');
      }

      const created = await JobTitle.create({
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
    const { JobTitle, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const row = await JobTitle.findOne({
        where: { id, tenant_id: DEFAULT_TENANT_ID },
        transaction: tx,
      });
      if (!row) throw ApiError.notFound('Job title not found');

      if (data.name !== undefined && data.name !== row.name) {
        const nameClash = await JobTitle.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
          transaction: tx,
        });
        if (nameClash) throw ApiError.conflict('A job title with this name already exists');
        row.name = data.name;
      }
      if (data.rank !== undefined && data.rank !== row.rank) {
        const rankClash = await JobTitle.findOne({
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
    const { JobTitle, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const row = await JobTitle.findOne({
        where: { id, tenant_id: DEFAULT_TENANT_ID },
        transaction: tx,
      });
      if (!row) throw ApiError.notFound('Job title not found');

      await row.destroy({ transaction: tx });
      await tx.commit();
      return { message: 'Job title deleted' };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async reorder(orderedIds) {
    const { JobTitle, sequelize } = require('../../database/models');
    const tx = await sequelize.transaction();
    try {
      const rows = await JobTitle.findAll({
        where: { tenant_id: DEFAULT_TENANT_ID, id: orderedIds },
        transaction: tx,
      });
      if (rows.length !== orderedIds.length) {
        throw ApiError.badRequest('One or more job title IDs are invalid');
      }

      // Two-phase update to dodge unique(rank) collisions: park them in a high range, then assign final ranks.
      const offset = 1000000;
      for (let i = 0; i < orderedIds.length; i += 1) {
        await JobTitle.update(
          { rank: offset + i + 1 },
          { where: { id: orderedIds[i], tenant_id: DEFAULT_TENANT_ID }, transaction: tx },
        );
      }
      for (let i = 0; i < orderedIds.length; i += 1) {
        await JobTitle.update(
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
