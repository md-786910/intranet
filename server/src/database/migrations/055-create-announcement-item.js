'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('announcement_item', {
      announcement_item_id: {
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
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
        defaultValue: 'DRAFT',
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('LOW', 'NORMAL', 'HIGH', 'URGENT'),
        defaultValue: 'NORMAL',
        allowNull: false,
      },
      show_in_marquee: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      marquee_starts_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      marquee_ends_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      published_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      unpublished_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      archived_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      owning_scope_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: false,
      },
      owning_scope_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      unpublished_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('announcement_item', ['tenant_id', 'status'], {
      name: 'announcement_item_tenant_status_idx',
    });
    await queryInterface.addIndex('announcement_item', ['author_id'], {
      name: 'announcement_item_author_idx',
    });
    await queryInterface.addIndex('announcement_item', ['owning_scope_type', 'owning_scope_id'], {
      name: 'announcement_item_scope_idx',
    });
    await queryInterface.addIndex('announcement_item', ['deleted_at'], {
      name: 'announcement_item_deleted_idx',
    });
    await queryInterface.addIndex('announcement_item', ['show_in_marquee', 'status'], {
      name: 'announcement_item_marquee_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('announcement_item');
  },
};
