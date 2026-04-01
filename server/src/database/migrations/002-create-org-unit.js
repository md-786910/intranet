'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_unit', {
      org_unit_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      parent_org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'org_unit', key: 'org_unit_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      node_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      path: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED'),
        defaultValue: 'ACTIVE',
        allowNull: false,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      timezone: {
        type: Sequelize.STRING(64),
        allowNull: true,
      },
      sort_order: {
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

    await queryInterface.addIndex('org_unit', ['parent_org_unit_id'], {
      name: 'org_unit_parent_idx',
    });
    await queryInterface.addIndex('org_unit', ['node_type', 'status'], {
      name: 'org_unit_type_status_idx',
    });
    await queryInterface.addIndex('org_unit', ['tenant_id'], {
      name: 'org_unit_tenant_idx',
    });
    await queryInterface.addIndex('org_unit', ['path'], {
      name: 'org_unit_path_idx',
    });
    await queryInterface.addIndex('org_unit', ['deleted_at'], {
      name: 'org_unit_deleted_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_unit');
  },
};
