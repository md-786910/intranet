'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('module_action', {
      module_action_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      module_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'module', key: 'module_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      action_code: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
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

    await queryInterface.addIndex('module_action', ['module_id', 'action_code'], {
      unique: true,
      name: 'module_action_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('module_action');
  },
};
