'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('password_reset', {
      reset_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onDelete: 'CASCADE',
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      token_hash: {
        type: Sequelize.STRING(64),
        allowNull: false,
        unique: true,
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      used_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('password_reset', ['user_id']);
    await queryInterface.addIndex('password_reset', ['token_hash'], { unique: true });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('password_reset');
  },
};
