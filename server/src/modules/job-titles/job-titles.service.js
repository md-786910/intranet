const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');

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
    const tx = await sequelize.transaction();
    try {
      const clash = await JobTitle.findOne({
        where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
        transaction: tx,
      });
      if (clash) throw ApiError.conflict('A job title with this name already exists');

      const created = await JobTitle.create(
        { tenant_id: DEFAULT_TENANT_ID, name: data.name },
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

      if (data.name !== undefined && data.name !== row.name) {
        const clash = await JobTitle.findOne({
          where: { tenant_id: DEFAULT_TENANT_ID, name: data.name },
          transaction: tx,
        });
        if (clash) throw ApiError.conflict('A job title with this name already exists');
        row.name = data.name;
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
