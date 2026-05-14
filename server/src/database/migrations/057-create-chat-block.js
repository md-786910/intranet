'use strict';

// Per-user chat reachability blocklist. Each row encodes "user_id can NOT see
// blocked_user_id in their chat search or open a new conversation with them".
// Admin-set blocks are written as two rows (A,B) and (B,A) by the application
// layer to make the block bidirectional with a simple subquery.

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_block', {
      chat_block_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      blocked_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
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

    await queryInterface.addIndex('chat_block', ['user_id', 'blocked_user_id'], {
      name: 'chat_block_pair_uniq',
      unique: true,
    });
    await queryInterface.addIndex('chat_block', ['user_id'], {
      name: 'chat_block_user_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_block');
  },
};
