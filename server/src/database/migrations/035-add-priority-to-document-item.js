'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_item', 'priority', {
      type: Sequelize.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
      allowNull: false,
      defaultValue: 'NORMAL',
    });

    await queryInterface.addIndex('document_item', ['priority'], {
      name: 'document_item_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('document_item', 'document_item_priority_idx').catch(() => {});
    await queryInterface.removeColumn('document_item', 'priority');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_document_item_priority"');
  },
};
