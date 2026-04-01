'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('analytics_event', {
      analytics_event_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      event_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      target_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      target_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      scope_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: true,
      },
      scope_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('analytics_event', ['event_type', 'created_at'], {
      name: 'analytics_event_type_time_idx',
    });
    await queryInterface.addIndex('analytics_event', ['user_id'], {
      name: 'analytics_event_user_idx',
    });
    await queryInterface.addIndex('analytics_event', ['target_type', 'target_id'], {
      name: 'analytics_event_target_idx',
    });
    await queryInterface.addIndex('analytics_event', ['scope_type', 'scope_id'], {
      name: 'analytics_event_scope_idx',
    });
    await queryInterface.addIndex('analytics_event', ['created_at'], {
      name: 'analytics_event_created_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('analytics_event');
  },
};
