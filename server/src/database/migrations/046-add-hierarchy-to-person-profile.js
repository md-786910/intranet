'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('person_profile', 'role_category_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'role_category', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addColumn('person_profile', 'reports_to_user_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'user_account', key: 'user_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('person_profile', ['role_category_id'], {
      name: 'person_profile_role_category_idx',
    });
    await queryInterface.addIndex('person_profile', ['reports_to_user_id'], {
      name: 'person_profile_reports_to_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('person_profile', 'person_profile_reports_to_idx');
    await queryInterface.removeIndex('person_profile', 'person_profile_role_category_idx');
    await queryInterface.removeColumn('person_profile', 'reports_to_user_id');
    await queryInterface.removeColumn('person_profile', 'role_category_id');
  },
};
