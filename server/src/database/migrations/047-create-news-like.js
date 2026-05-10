'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_like', {
      id: {
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
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('news_like', ['news_item_id', 'user_id'], {
      unique: true,
      name: 'news_like_news_user_unique',
    });
    await queryInterface.addIndex('news_like', ['news_item_id'], {
      name: 'news_like_news_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_like');
  },
};
