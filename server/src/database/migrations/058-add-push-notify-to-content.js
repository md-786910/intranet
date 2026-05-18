'use strict';

// Adds `push_notify` to news_item, announcement_item, document_item.
// Default TRUE so existing rows preserve the previous always-notify behavior.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = ['news_item', 'announcement_item', 'document_item'];
    for (const table of tables) {
      await queryInterface.addColumn(table, 'push_notify', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      });
    }
  },

  async down(queryInterface) {
    const tables = ['news_item', 'announcement_item', 'document_item'];
    for (const table of tables) {
      await queryInterface.removeColumn(table, 'push_notify').catch(() => {});
    }
  },
};
