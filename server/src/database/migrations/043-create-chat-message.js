'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('chat_message', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      conversation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'conversation', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      sender_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      message_type: {
        type: Sequelize.ENUM('TEXT', 'ATTACHMENT'),
        allowNull: false,
        defaultValue: 'TEXT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('chat_message', ['conversation_id', 'created_at'], {
      name: 'idx_chat_message_conv_created',
    });
    await queryInterface.addIndex('chat_message', ['sender_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('chat_message');
    // Clean up the ENUM type created by PostgreSQL
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_chat_message_message_type";');
  },
};
