'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('office_location', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      organisation_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'organisation', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      code: {
        type: Sequelize.STRING(64),
        allowNull: true,
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

    await queryInterface.addIndex('office_location', ['organisation_id'], {
      name: 'office_location_org_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('office_location');
  },
};
