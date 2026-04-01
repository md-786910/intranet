'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('push_campaign', {
      push_campaign_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED'),
        defaultValue: 'DRAFT',
        allowNull: false,
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      owning_scope_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: false,
      },
      owning_scope_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      scheduled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      recipient_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      },
      deleted_at: {
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

    await queryInterface.addIndex('push_campaign', ['tenant_id', 'status'], {
      name: 'push_campaign_tenant_status_idx',
    });
    await queryInterface.addIndex('push_campaign', ['created_by'], {
      name: 'push_campaign_created_by_idx',
    });
    await queryInterface.addIndex('push_campaign', ['deleted_at'], {
      name: 'push_campaign_deleted_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('push_campaign');
  },
};
