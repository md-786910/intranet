'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('role_permission', {
      role_permission_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'role', key: 'role_id' },
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

    await queryInterface.addIndex('role_permission', ['role_id', 'module_action_id'], {
      unique: true,
      name: 'role_permission_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('role_permission');
  },
};
