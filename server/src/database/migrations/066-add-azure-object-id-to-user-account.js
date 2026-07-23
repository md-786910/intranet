'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_account', 'azure_object_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
    await queryInterface.addIndex('user_account', ['azure_object_id'], {
      unique: true,
      name: 'user_account_azure_object_id_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('user_account', 'user_account_azure_object_id_unique');
    await queryInterface.removeColumn('user_account', 'azure_object_id');
  },
};
