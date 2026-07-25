'use strict';

const { formatJobTitleName } = require('../../utils/jobTitleFormat');

/**
 * Normalize job_title.name to Title Case and merge case-insensitive duplicates.
 * Also rewrites matching person_profile.job_title values.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const { QueryTypes } = require('sequelize');

    const rows = await sequelize.query(
      `SELECT id, tenant_id, name FROM job_title ORDER BY id ASC`,
      { type: QueryTypes.SELECT },
    );

    const byKey = new Map();
    for (const row of rows) {
      const formatted = formatJobTitleName(row.name);
      if (!formatted) continue;
      const key = `${row.tenant_id}::${formatted.toLowerCase()}`;
      if (!byKey.has(key)) byKey.set(key, { formatted, rows: [] });
      byKey.get(key).rows.push(row);
    }

    for (const group of byKey.values()) {
      group.rows.sort((a, b) => a.id - b.id);
      const keeper = group.rows[0];
      const duplicates = group.rows.slice(1);
      const oldNames = [...new Set(group.rows.map((r) => r.name))];

      if (keeper.name !== group.formatted) {
        await sequelize.query(
          `UPDATE job_title SET name = :name, updated_at = NOW() WHERE id = :id`,
          { replacements: { name: group.formatted, id: keeper.id } },
        );
      }

      for (const dup of duplicates) {
        await sequelize.query(`DELETE FROM job_title WHERE id = :id`, {
          replacements: { id: dup.id },
        });
      }

      for (const oldName of oldNames) {
        if (oldName === group.formatted) continue;
        await sequelize.query(
          `UPDATE person_profile
           SET job_title = :formatted, updated_at = NOW()
           WHERE job_title = :oldName`,
          { replacements: { formatted: group.formatted, oldName } },
        );
      }
    }
  },

  async down() {
    // Irreversible normalization.
  },
};
