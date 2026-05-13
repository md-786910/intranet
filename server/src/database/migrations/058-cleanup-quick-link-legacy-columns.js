'use strict';

// Drop legacy `quick_link` columns that the current model no longer uses:
// status, author_id, owning_scope_type, owning_scope_id, published_at,
// archived_at. They were carried over from an earlier "authored / scoped"
// design and now block every INSERT with NOT NULL violations.
//
// Idempotent: each column drop is guarded by describeTable. Enum types left
// behind by `status` / `owning_scope_type` are dropped explicitly.

const LEGACY_COLUMNS = [
  'archived_at',
  'published_at',
  'owning_scope_id',
  'owning_scope_type',
  'author_id',
  'status',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('quick_link');

    for (const column of LEGACY_COLUMNS) {
      if (table[column]) {
        await queryInterface.removeColumn('quick_link', column);
      }
    }

    // Postgres leaves enum types behind when their column is dropped.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_quick_link_status"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_quick_link_owning_scope_type"');
  },

  async down() {
    // Intentionally not restoring legacy columns — restoring NOT NULL fields
    // would require backfill data we don't have. Reapply the older create
    // migration manually if rollback is ever needed.
  },
};
