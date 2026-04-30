'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('news_item', 'category_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'category', key: 'category_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('news_item', ['category_id'], {
      name: 'news_item_category_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('news_item', 'news_item_category_idx').catch(() => {});
    await queryInterface.removeColumn('news_item', 'category_id');
  },
};
