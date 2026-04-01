'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('org_unit_closure', {
      ancestor_org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'org_unit', key: 'org_unit_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      descendant_org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'org_unit', key: 'org_unit_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        primaryKey: true,
      },
      depth: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
    });

    await queryInterface.addIndex('org_unit_closure', ['descendant_org_unit_id'], {
      name: 'org_unit_closure_descendant_idx',
    });
    await queryInterface.addIndex('org_unit_closure', ['depth'], {
      name: 'org_unit_closure_depth_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('org_unit_closure');
  },
};
