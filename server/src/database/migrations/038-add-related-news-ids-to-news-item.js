'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('news_item', 'related_news_ids', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    await queryInterface.addIndex('news_item', ['related_news_ids'], {
      name: 'news_item_related_ids_gin',
      using: 'GIN',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('news_item', 'news_item_related_ids_gin').catch(() => {});
    await queryInterface.removeColumn('news_item', 'related_news_ids');
  },
};
