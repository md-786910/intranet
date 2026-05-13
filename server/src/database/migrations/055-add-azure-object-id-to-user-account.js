'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('user_account', 'azure_object_id', {
      type: Sequelize.STRING(64),
      allowNull: true,
      unique: true,
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('user_account', 'azure_object_id');
  },
};
