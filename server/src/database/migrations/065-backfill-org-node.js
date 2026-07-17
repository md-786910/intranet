'use strict';

/**
 * Data migration: populate org_node from the legacy office_location / vertical /
 * department tables, copy department memberships into node_membership, and remap
 * every legacy scope pointer (scope_id / owning_scope_id / target_scope_id) onto
 * the new node ids.
 *
 * Structure produced per organisation:
 *   GROUP (org)  ->  COMPANY "Default Company"  ->  offices -> verticals -> departments
 * so existing offices (previously directly under the organisation) keep working
 * while gaining the new COMPANY level the model requires.
 *
 * Legacy tables are NOT dropped here — a later migration removes them once the
 * cutover is verified. Each new node stores legacy_ref = "<OLD_TYPE>:<old_id>".
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    const { QueryTypes } = require('sequelize');
    const t = await sequelize.transaction();

    const insertNode = async (row) => {
      const [res] = await sequelize.query(
        `INSERT INTO org_node
           (organisation_id, parent_id, node_type, kind, name, code, status,
            address, city, country, timezone, sort_order, legacy_ref, deleted_at,
            created_at, updated_at)
         VALUES
           (:organisation_id, :parent_id, :node_type, :kind, :name, :code, :status,
            :address, :city, :country, :timezone, :sort_order, :legacy_ref, :deleted_at,
            NOW(), NOW())
         RETURNING id`,
        { replacements: row, type: QueryTypes.INSERT, transaction: t },
      );
      const id = res[0].id;
      return id;
    };

    const setPath = async (id, path) => {
      await sequelize.query('UPDATE org_node SET path = :path WHERE id = :id', {
        replacements: { id, path }, transaction: t,
      });
    };

    try {
      const orgs = await sequelize.query(
        'SELECT id, name, code, status FROM organisation ORDER BY id ASC',
        { type: QueryTypes.SELECT, transaction: t },
      );

      for (const org of orgs) {
        // GROUP root
        const groupId = await insertNode({
          organisation_id: org.id, parent_id: null,
          node_type: 'GROUP', kind: 'OPERATIONAL',
          name: org.name, code: org.code || null, status: org.status || 'ACTIVE',
          address: null, city: null, country: null, timezone: null, sort_order: 0,
          legacy_ref: `ORGANISATION:${org.id}`, deleted_at: null,
        });
        await setPath(groupId, `${groupId}/`);

        // Default COMPANY to hold pre-existing offices
        const companyId = await insertNode({
          organisation_id: org.id, parent_id: groupId,
          node_type: 'COMPANY', kind: 'OPERATIONAL',
          name: 'Default Company', code: 'DEFAULT', status: 'ACTIVE',
          address: null, city: null, country: null, timezone: null, sort_order: 0,
          legacy_ref: null, deleted_at: null,
        });
        await setPath(companyId, `${groupId}/${companyId}/`);
        const companyPath = `${groupId}/${companyId}/`;

        // Offices (include soft-deleted so scope pointers to them still remap)
        const offices = await sequelize.query(
          `SELECT id, name, code, status, address, city, country, timezone, sort_order, deleted_at
           FROM office_location WHERE organisation_id = :orgId ORDER BY id ASC`,
          { replacements: { orgId: org.id }, type: QueryTypes.SELECT, transaction: t },
        );

        for (const office of offices) {
          const officeId = await insertNode({
            organisation_id: org.id, parent_id: companyId,
            node_type: 'OFFICE_LOCATION', kind: 'OPERATIONAL',
            name: office.name, code: office.code || null, status: office.status || 'ACTIVE',
            address: office.address || null, city: office.city || null,
            country: office.country || null, timezone: office.timezone || null,
            sort_order: office.sort_order || 0,
            legacy_ref: `OFFICE_LOCATION:${office.id}`, deleted_at: office.deleted_at || null,
          });
          const officePath = `${companyPath}${officeId}/`;
          await setPath(officeId, officePath);

          const verticals = await sequelize.query(
            `SELECT id, name, code, status, sort_order, deleted_at
             FROM vertical WHERE office_location_id = :officeLegacyId ORDER BY id ASC`,
            { replacements: { officeLegacyId: office.id }, type: QueryTypes.SELECT, transaction: t },
          );

          for (const vertical of verticals) {
            const verticalId = await insertNode({
              organisation_id: org.id, parent_id: officeId,
              node_type: 'VERTICAL', kind: 'OPERATIONAL',
              name: vertical.name, code: vertical.code || null, status: vertical.status || 'ACTIVE',
              address: null, city: null, country: null, timezone: null,
              sort_order: vertical.sort_order || 0,
              legacy_ref: `VERTICAL:${vertical.id}`, deleted_at: vertical.deleted_at || null,
            });
            const verticalPath = `${officePath}${verticalId}/`;
            await setPath(verticalId, verticalPath);

            const departments = await sequelize.query(
              `SELECT id, name, code, status, sort_order, deleted_at
               FROM department WHERE vertical_id = :verticalLegacyId ORDER BY id ASC`,
              { replacements: { verticalLegacyId: vertical.id }, type: QueryTypes.SELECT, transaction: t },
            );

            for (const dept of departments) {
              const deptId = await insertNode({
                organisation_id: org.id, parent_id: verticalId,
                node_type: 'DEPARTMENT', kind: 'OPERATIONAL',
                name: dept.name, code: dept.code || null, status: dept.status || 'ACTIVE',
                address: null, city: null, country: null, timezone: null,
                sort_order: dept.sort_order || 0,
                legacy_ref: `DEPARTMENT:${dept.id}`, deleted_at: dept.deleted_at || null,
              });
              await setPath(deptId, `${verticalPath}${deptId}/`);
            }
          }
        }
      }

      // Copy department memberships onto their new department nodes.
      await sequelize.query(
        `INSERT INTO node_membership (user_id, node_id, is_primary, joined_at, created_at, updated_at)
         SELECT dm.user_id, onode.id, dm.is_primary, dm.joined_at, NOW(), NOW()
         FROM department_membership dm
         JOIN org_node onode ON onode.legacy_ref = 'DEPARTMENT:' || dm.department_id
         ON CONFLICT DO NOTHING`,
        { transaction: t },
      );

      // Remap every legacy scope pointer to the new node id. Covers scope_id,
      // owning_scope_id and target_scope_id wherever they appear.
      const scopeCols = await sequelize.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name LIKE '%scope_id'`,
        { type: QueryTypes.SELECT, transaction: t },
      );

      for (const { table_name, column_name } of scopeCols) {
        const typeCol = column_name.replace(/scope_id$/, 'scope_type');
        // Confirm the sibling type column exists before attempting the remap.
        const [{ exists }] = await sequelize.query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = :tbl AND column_name = :col
           ) AS exists`,
          { replacements: { tbl: table_name, col: typeCol }, type: QueryTypes.SELECT, transaction: t },
        );
        if (!exists) continue;

        await sequelize.query(
          `UPDATE "${table_name}" x
           SET "${column_name}" = onode.id
           FROM org_node onode
           WHERE onode.legacy_ref = x."${typeCol}"::text || ':' || x."${column_name}"::text`,
          { transaction: t },
        );
      }

      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    const { QueryTypes } = require('sequelize');
    const t = await sequelize.transaction();
    try {
      // Reverse the scope remap: node id -> original legacy id, using legacy_ref.
      const scopeCols = await sequelize.query(
        `SELECT table_name, column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND column_name LIKE '%scope_id'`,
        { type: QueryTypes.SELECT, transaction: t },
      );
      for (const { table_name, column_name } of scopeCols) {
        const typeCol = column_name.replace(/scope_id$/, 'scope_type');
        const [{ exists }] = await sequelize.query(
          `SELECT EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = :tbl AND column_name = :col
           ) AS exists`,
          { replacements: { tbl: table_name, col: typeCol }, type: QueryTypes.SELECT, transaction: t },
        );
        if (!exists) continue;

        // Restore original id from legacy_ref (format "<TYPE>:<id>").
        await sequelize.query(
          `UPDATE "${table_name}" x
           SET "${column_name}" = split_part(onode.legacy_ref, ':', 2)::integer
           FROM org_node onode
           WHERE onode.id = x."${column_name}" AND onode.legacy_ref IS NOT NULL`,
          { transaction: t },
        );
      }

      await sequelize.query('DELETE FROM node_membership', { transaction: t });
      await sequelize.query('DELETE FROM org_node', { transaction: t });
      await t.commit();
    } catch (err) {
      await t.rollback();
      throw err;
    }
  },
};
