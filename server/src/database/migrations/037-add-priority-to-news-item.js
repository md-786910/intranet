'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('news_item', 'priority', {
      type: Sequelize.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
      allowNull: false,
      defaultValue: 'NORMAL',
    });

    await queryInterface.addIndex('news_item', ['priority'], {
      name: 'news_item_priority_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('news_item', 'news_item_priority_idx').catch(() => {});
    await queryInterface.removeColumn('news_item', 'priority');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_news_item_priority"');
  },
};
