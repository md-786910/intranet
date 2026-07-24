'use strict';

/** Entra Job Information: company_name + employee_type on person_profile. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('person_profile');

    if (!table.company_name) {
      await queryInterface.addColumn('person_profile', 'company_name', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!table.employee_type) {
      await queryInterface.addColumn('person_profile', 'employee_type', {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('person_profile');
    if (table.employee_type) {
      await queryInterface.removeColumn('person_profile', 'employee_type');
    }
    if (table.company_name) {
      await queryInterface.removeColumn('person_profile', 'company_name');
    }
  },
};
