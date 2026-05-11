'use strict';

// Enforces one notification per (user_id, type, entity_id) so admins can
// "Send Notification" repeatedly without filling the bell with duplicates.
// Existing duplicate rows are collapsed to the newest before the unique
// constraint is added — otherwise the index creation would fail.

module.exports = {
  async up(queryInterface) {
    // Keep the most recent row per (user_id, type, entity_id); delete the rest.
    await queryInterface.sequelize.query(`
      DELETE FROM notification a
      USING notification b
      WHERE a.user_id   = b.user_id
        AND a.type      = b.type
        AND a.entity_id = b.entity_id
        AND a.notification_id < b.notification_id
    `);

    await queryInterface.addIndex('notification', ['user_id', 'type', 'entity_id'], {
      name: 'notification_user_entity_unique',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('notification', 'notification_user_entity_unique');
  },
};
