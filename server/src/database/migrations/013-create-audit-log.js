'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_log', {
      audit_log_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      action: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      resource_type: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      resource_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      details: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      request_id: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      result: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('audit_log', ['user_id'], {
      name: 'audit_log_user_idx',
    });
    await queryInterface.addIndex('audit_log', ['action'], {
      name: 'audit_log_action_idx',
    });
    await queryInterface.addIndex('audit_log', ['resource_type', 'resource_id'], {
      name: 'audit_log_resource_idx',
    });
    await queryInterface.addIndex('audit_log', ['created_at'], {
      name: 'audit_log_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('audit_log');
  },
};
