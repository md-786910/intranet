'use strict';

// Adds scheduling columns to news_item, announcement_item, document_item.
// scheduled_at = when the periodic publisher should auto-publish the row.
// scheduled_by = audit pointer to the user who scheduled it.
// A partial index on (scheduled_at) WHERE status = 'SCHEDULED' keeps the
// poller's hot query (`status='SCHEDULED' AND scheduled_at <= NOW()`) fast
// without bloating the full table.

const TABLES = ['news_item', 'announcement_item', 'document_item'];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const table of TABLES) {
      await queryInterface.addColumn(table, 'scheduled_at', {
        type: Sequelize.DATE,
        allowNull: true,
      });
      await queryInterface.addColumn(table, 'scheduled_by', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await queryInterface.sequelize.query(
        `CREATE INDEX IF NOT EXISTS ${table}_due_idx
         ON ${table} (scheduled_at)
         WHERE status = 'SCHEDULED'`
      );
    }
  },

  async down(queryInterface) {
    for (const table of TABLES) {
      await queryInterface.sequelize
        .query(`DROP INDEX IF EXISTS ${table}_due_idx`)
        .catch(() => {});
      await queryInterface.removeColumn(table, 'scheduled_by').catch(() => {});
      await queryInterface.removeColumn(table, 'scheduled_at').catch(() => {});
    }
  },
};
