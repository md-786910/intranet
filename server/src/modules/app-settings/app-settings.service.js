'use strict';

const auditService = require('../../services/audit.service');

const DEFAULTS = {
  id: 1,
  application_name: 'BrightNow',
  meta_title: 'BrightNow',
};

async function ensureRow() {
  const { AppSettings } = require('../../database/models');
  const [row] = await AppSettings.findOrCreate({
    where: { id: 1 },
    defaults: {
      id: 1,
      application_name: DEFAULTS.application_name,
      meta_title: DEFAULTS.meta_title,
    },
  });
  return row;
}

function toPublic(row) {
  return {
    application_name: row.application_name || DEFAULTS.application_name,
    meta_title: row.meta_title || DEFAULTS.meta_title,
  };
}

const service = {
  async get() {
    const row = await ensureRow();
    return toPublic(row);
  },

  async update(data, userId, meta = {}) {
    const row = await ensureRow();
    row.application_name = String(data.application_name).trim();
    row.meta_title = String(data.meta_title).trim();
    row.updated_by = userId || null;
    await row.save();

    await auditService.log({
      user_id: userId || null,
      action: 'APP_SETTINGS_UPDATE',
      resource_type: 'AppSettings',
      resource_id: 1,
      details: {
        application_name: row.application_name,
        meta_title: row.meta_title,
      },
      ip_address: meta.ip || null,
      user_agent: meta.userAgent || null,
      request_id: meta.requestId || null,
      result: 'SUCCESS',
    });

    return toPublic(row);
  },
};

module.exports = service;
