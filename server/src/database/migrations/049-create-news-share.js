'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_share', {
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
      channel: {
        type: Sequelize.STRING(32),
        allowNull: false,
      },
      token: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      view_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      revoked_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('news_share', ['token'], {
      unique: true,
      name: 'news_share_token_unique',
    });
    await queryInterface.addIndex('news_share', ['news_item_id'], {
      name: 'news_share_news_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_share');
  },
};
