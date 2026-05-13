'use strict';

// Removes the legacy `icon NOT NULL` column from quick_link. The column was
// removed from the model but lingered in older databases, causing every INSERT
// to fail with a not-null constraint violation. Idempotent: no-op when the
// column is already gone.

module.exports = {
  async up(queryInterface) {
    const table = await queryInterface.describeTable('quick_link');
    if (!table.icon) return;
    await queryInterface.removeColumn('quick_link', 'icon');
  },

  async down(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('quick_link');
    if (table.icon) return;
    // Restore as nullable on rollback — original NOT NULL would need a backfill.
    await queryInterface.addColumn('quick_link', 'icon', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },
};
