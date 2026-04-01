'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('department_membership', {
      membership_id: {
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
      department_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'department', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_primary: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      joined_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('NOW()'),
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

    await queryInterface.addIndex('department_membership', ['user_id', 'department_id'], {
      unique: true,
      name: 'dept_membership_user_dept_unique',
    });
    await queryInterface.addIndex('department_membership', ['department_id'], {
      name: 'dept_membership_dept_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('department_membership');
  },
};
