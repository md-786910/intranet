'use strict';

/** Separate business phone (phone) from mobile phone (mobile_phone). */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('user_account', 'mobile_phone', {
      type: Sequelize.STRING(20),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('user_account', 'mobile_phone');
  },
};
