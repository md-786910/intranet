'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_permission', {
      user_permission_id: {
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
      module_action_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'module_action', key: 'module_action_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      effect: {
        type: Sequelize.ENUM('ALLOW', 'DENY'),
        defaultValue: 'ALLOW',
        allowNull: false,
      },
      scope_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: false,
      },
      scope_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      assigned_by: {
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

    await queryInterface.addIndex('user_permission', ['user_id', 'module_action_id', 'scope_type', 'scope_id'], {
      unique: true,
      name: 'user_permission_unique',
    });

    await queryInterface.addIndex('user_permission', ['user_id'], {
      name: 'user_permission_user_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_permission');
  },
};
