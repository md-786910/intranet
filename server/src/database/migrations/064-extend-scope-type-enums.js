'use strict';

/**
 * The polymorphic scope columns (scope_type / owning_scope_type) on
 * user_role_assignment, user_permission and the content tables are Postgres
 * ENUMs originally limited to the four legacy levels. Add GROUP, COMPANY and
 * ADMIN_UNIT so a scope can point at any org_node type.
 *
 * We discover every enum type that already contains 'ORGANISATION' rather than
 * hard-coding the auto-generated type names, so this stays correct regardless
 * of which tables carry a scope column.
 *
 * Note: enum values cannot be removed in Postgres, so `down` is a no-op.
 */
module.exports = {
  async up(queryInterface) {
    const [rows] = await queryInterface.sequelize.query(`
      SELECT DISTINCT t.typname
      FROM pg_type t
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE e.enumlabel = 'ORGANISATION'
    `);

    const newValues = ['GROUP', 'COMPANY', 'ADMIN_UNIT'];
    for (const { typname } of rows) {
      for (const val of newValues) {
        // ADD VALUE IF NOT EXISTS is idempotent; safe to re-run.
        // eslint-disable-next-line no-await-in-loop
        await queryInterface.sequelize.query(
          `ALTER TYPE "${typname}" ADD VALUE IF NOT EXISTS '${val}'`
        );
      }
    }
  },

  async down() {
    // Postgres cannot drop enum values without recreating the type; no-op.
  },
};
