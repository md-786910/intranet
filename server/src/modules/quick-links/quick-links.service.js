const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');

const service = {
  async list() {
    const { QuickLink } = require('../../database/models');
    return QuickLink.findAll({
      where: { tenant_id: DEFAULT_TENANT_ID },
      order: [['created_at', 'ASC']],
    });
  },

  async create(data, userId) {
    const { QuickLink } = require('../../database/models');
    return QuickLink.create({
      tenant_id: DEFAULT_TENANT_ID,
      label: data.label,
      url: data.url,
      created_by: userId || null,
    });
  },

  async update(id, data) {
    const { QuickLink } = require('../../database/models');
    const row = await QuickLink.findOne({
      where: { quick_link_id: id, tenant_id: DEFAULT_TENANT_ID },
    });
    if (!row) throw ApiError.notFound('Quick link not found');

    if (data.label !== undefined) row.label = data.label;
    if (data.url !== undefined) row.url = data.url;
    await row.save();
    return row;
  },

  async remove(id) {
    const { QuickLink } = require('../../database/models');
    const row = await QuickLink.findOne({
      where: { quick_link_id: id, tenant_id: DEFAULT_TENANT_ID },
    });
    if (!row) throw ApiError.notFound('Quick link not found');

    // Soft delete — set deleted_at; defaultScope hides it from future reads.
    row.deleted_at = new Date();
    await row.save();
    return { message: 'Quick link deleted' };
  },
};

module.exports = service;
