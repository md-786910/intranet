'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_comment', {
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
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
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
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('news_comment', ['news_item_id', 'created_at'], {
      name: 'news_comment_news_created_idx',
    });
    await queryInterface.addIndex('news_comment', ['user_id'], {
      name: 'news_comment_user_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_comment');
  },
};
