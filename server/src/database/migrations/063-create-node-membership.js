'use strict';

/**
 * Generalizes department_membership: a user may attach to ANY org_node
 * (company, office, vertical, department, or an administrative unit).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('node_membership', {
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
      node_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'org_node', key: 'id' },
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

    await queryInterface.addIndex('node_membership', ['user_id', 'node_id'], {
      unique: true,
      name: 'node_membership_user_node_unique',
    });
    await queryInterface.addIndex('node_membership', ['node_id'], {
      name: 'node_membership_node_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('node_membership');
  },
};
