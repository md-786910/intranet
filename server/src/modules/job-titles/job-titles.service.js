const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { formatJobTitleName } = require('../../utils/jobTitleFormat');

async function findByNameCi(JobTitle, sequelize, name, { transaction, excludeId } = {}) {
  const where = {
    tenant_id: DEFAULT_TENANT_ID,
    [Op.and]: sequelize.where(
      sequelize.fn('LOWER', sequelize.col('name')),
      name.toLowerCase(),
    ),
  };
  if (excludeId != null) {
    where.id = { [Op.ne]: excludeId };
  }
  return JobTitle.findOne({ where, transaction });
}

const service = {
  async list() {
    const { JobTitle } = require('../../database/models');
    return JobTitle.findAll({
      where: { tenant_id: DEFAULT_TENANT_ID },
      order: [['name', 'ASC']],
    });
  },

  async getById(id) {
    const { JobTitle } = require('../../database/models');
    const row = await JobTitle.findOne({ where: { id, tenant_id: DEFAULT_TENANT_ID } });
    if (!row) throw ApiError.notFound('Job title not found');
    return row;
  },

  async create(data) {
    const { JobTitle, sequelize } = require('../../database/models');
    const name = formatJobTitleName(data.name);
    if (!name) throw ApiError.badRequest('Name is required');

    const tx = await sequelize.transaction();
    try {
      const clash = await findByNameCi(JobTitle, sequelize, name, { transaction: tx });
      if (clash) throw ApiError.conflict('A job title with this name already exists');

      const maxRank = await JobTitle.max('rank', {
        where: { tenant_id: DEFAULT_TENANT_ID },
        transaction: tx,
      });
      const created = await JobTitle.create(
        {
          tenant_id: DEFAULT_TENANT_ID,
          name,
          rank: data.rank || (maxRank || 0) + 1,
          description: data.description || null,
        },
        { transaction: tx },
      );
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
      const row = await JobTitle.findOne({ where: { id, tenant_id: DEFAULT_TENANT_ID }, transaction: tx });
      if (!row) throw ApiError.notFound('Job title not found');

      if (data.name !== undefined) {
        const name = formatJobTitleName(data.name);
        if (!name) throw ApiError.badRequest('Name is required');

        if (name.toLowerCase() !== String(row.name || '').toLowerCase()) {
          const clash = await findByNameCi(JobTitle, sequelize, name, {
            transaction: tx,
            excludeId: id,
          });
          if (clash) throw ApiError.conflict('A job title with this name already exists');
        }
        row.name = name;
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
      const row = await JobTitle.findOne({ where: { id, tenant_id: DEFAULT_TENANT_ID }, transaction: tx });
      if (!row) throw ApiError.notFound('Job title not found');
      await row.destroy({ transaction: tx });
      await tx.commit();
      return { message: 'Job title deleted' };
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },
};

module.exports = service;
