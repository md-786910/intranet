'use strict';

// Repairs DBs that ran an older revision of 050-create-quick-link.js (before
// `created_by` was added to that migration). Idempotent: skips when the column
// is already present.

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('quick_link');
    if (table.created_by) return;

    await queryInterface.addColumn('quick_link', 'created_by', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'user_account', key: 'user_id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('quick_link');
    if (!table.created_by) return;
    await queryInterface.removeColumn('quick_link', 'created_by');
  },
};
