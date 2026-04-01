'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('user_role_assignment', {
      assignment_id: {
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
      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'role', key: 'role_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'org_unit', key: 'org_unit_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      assigned_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      starts_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('user_role_assignment', ['user_id', 'role_id', 'org_unit_id'], {
      unique: true,
      name: 'user_role_assignment_unique',
    });
    await queryInterface.addIndex('user_role_assignment', ['user_id', 'org_unit_id'], {
      name: 'user_role_assignment_user_org_idx',
    });
    await queryInterface.addIndex('user_role_assignment', ['org_unit_id'], {
      name: 'user_role_assignment_org_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('user_role_assignment');
  },
};
