'use strict';

/**
 * Ensure each GROUP has a COMPANY child named like the organisation.
 * - Renames legacy "Default Company" / DEFAULT code to the org name/code.
 * - Creates a COMPANY under any GROUP that has none (fixes empty company stats).
 * Does not touch GROUP legacy_ref or scope remaps.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const { QueryTypes } = require('sequelize');

    // Rename Default Company nodes to match their organisation.
    await sequelize.query(`
      UPDATE org_node c
      SET
        name = COALESCE(NULLIF(TRIM(o.name), ''), c.name),
        code = COALESCE(NULLIF(TRIM(o.code), ''), c.code),
        updated_at = NOW()
      FROM organisation o
      WHERE c.organisation_id = o.id
        AND c.node_type = 'COMPANY'
        AND c.deleted_at IS NULL
        AND (
          c.name = 'Default Company'
          OR UPPER(COALESCE(c.code, '')) = 'DEFAULT'
        )
    `);

    // Groups with no active COMPANY child — create one named like the org.
    const groupsMissingCompany = await sequelize.query(
      `
      SELECT g.id AS group_id, g.organisation_id, g.path AS group_path,
             o.name AS org_name, o.code AS org_code
      FROM org_node g
      JOIN organisation o ON o.id = g.organisation_id
      WHERE g.node_type = 'GROUP'
        AND g.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM org_node c
          WHERE c.parent_id = g.id
            AND c.node_type = 'COMPANY'
            AND c.deleted_at IS NULL
        )
      ORDER BY g.id ASC
      `,
      { type: QueryTypes.SELECT },
    );

    for (const row of groupsMissingCompany) {
      const name = (row.org_name && String(row.org_name).trim()) || 'Company';
      const code = (row.org_code && String(row.org_code).trim()) || null;
      const [inserted] = await sequelize.query(
        `
        INSERT INTO org_node
          (organisation_id, parent_id, node_type, kind, name, code, status,
           sort_order, legacy_ref, path, created_at, updated_at)
        VALUES
          (:organisation_id, :parent_id, 'COMPANY', 'OPERATIONAL', :name, :code, 'ACTIVE',
           0, NULL, NULL, NOW(), NOW())
        RETURNING id
        `,
        {
          replacements: {
            organisation_id: row.organisation_id,
            parent_id: row.group_id,
            name,
            code,
          },
          type: QueryTypes.SELECT,
        },
      );
      const companyId = inserted.id;
      const groupPath = row.group_path || `${row.group_id}/`;
      await sequelize.query(
        `UPDATE org_node SET path = :path WHERE id = :id`,
        { replacements: { id: companyId, path: `${groupPath}${companyId}/` } },
      );
    }
  },

  async down() {
    // Non-destructive data fix; no safe automatic reverse.
  },
};
