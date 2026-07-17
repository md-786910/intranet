'use strict';

/**
 * Generic self-referential organisation tree. A single table replaces the rigid
 * office_location / vertical / department chain and also models the GROUP root,
 * COMPANY (operational units) and ADMIN_UNIT (administrative units). Depth is
 * flexible — any structural node may contain verticals, departments or members.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_node', {
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
      // Nullable for the root node; self-FK added below.
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      node_type: {
        type: Sequelize.ENUM('GROUP', 'COMPANY', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT', 'ADMIN_UNIT'),
        allowNull: false,
      },
      kind: {
        type: Sequelize.ENUM('OPERATIONAL', 'ADMINISTRATIVE'),
        allowNull: false,
        defaultValue: 'OPERATIONAL',
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
      // Location fields — used only by OFFICE_LOCATION nodes.
      address: { type: Sequelize.TEXT, allowNull: true },
      city: { type: Sequelize.STRING(128), allowNull: true },
      country: { type: Sequelize.STRING(64), allowNull: true },
      timezone: { type: Sequelize.STRING(64), allowNull: true },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      // Materialized path of ancestor ids, e.g. "1/4/9/" — fast subtree queries.
      path: { type: Sequelize.STRING(1024), allowNull: true },
      // Backfill provenance, e.g. "OFFICE_LOCATION:12" — lets the migration remap
      // legacy scope pointers set-based and lets `down` reverse the remap.
      legacy_ref: { type: Sequelize.STRING(64), allowNull: true },
      deleted_at: { type: Sequelize.DATE, allowNull: true },
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

    // Self-referential parent FK (added after table creation to avoid ordering issues).
    await queryInterface.addConstraint('org_node', {
      fields: ['parent_id'],
      type: 'foreign key',
      name: 'org_node_parent_fk',
      references: { table: 'org_node', field: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE',
    });

    await queryInterface.addIndex('org_node', ['organisation_id'], { name: 'org_node_org_idx' });
    await queryInterface.addIndex('org_node', ['parent_id'], { name: 'org_node_parent_idx' });
    await queryInterface.addIndex('org_node', ['node_type'], { name: 'org_node_type_idx' });
    await queryInterface.addIndex('org_node', ['path'], { name: 'org_node_path_idx' });
    await queryInterface.addIndex('org_node', ['legacy_ref'], { name: 'org_node_legacy_ref_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_node');
    // Drop the enum types Sequelize created for this table.
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_org_node_node_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_org_node_kind"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_org_node_status"');
  },
};
