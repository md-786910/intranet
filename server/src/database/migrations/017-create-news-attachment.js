'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_attachment', {
      news_attachment_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      news_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'news_item', key: 'news_item_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      media_asset_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'media_asset', key: 'media_asset_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('news_attachment', ['news_item_id'], {
      name: 'news_attachment_news_item_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_attachment');
  },
};
