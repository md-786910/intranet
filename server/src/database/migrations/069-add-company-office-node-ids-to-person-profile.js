'use strict';

/** Link person_profile to org_node COMPANY / OFFICE_LOCATION. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('person_profile');

    if (!table.company_node_id) {
      await queryInterface.addColumn('person_profile', 'company_node_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'org_node', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('person_profile', ['company_node_id'], {
        name: 'person_profile_company_node_idx',
      });
    }

    if (!table.office_node_id) {
      await queryInterface.addColumn('person_profile', 'office_node_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'org_node', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      });
      await queryInterface.addIndex('person_profile', ['office_node_id'], {
        name: 'person_profile_office_node_idx',
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('person_profile');
    if (table.office_node_id) {
      await queryInterface.removeIndex('person_profile', 'person_profile_office_node_idx');
      await queryInterface.removeColumn('person_profile', 'office_node_id');
    }
    if (table.company_node_id) {
      await queryInterface.removeIndex('person_profile', 'person_profile_company_node_idx');
      await queryInterface.removeColumn('person_profile', 'company_node_id');
    }
  },
};
