'use strict';

/** Allow optional last_name on user_account. */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.changeColumn('user_account', 'last_name', {
      type: Sequelize.STRING(100),
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      UPDATE user_account SET last_name = '' WHERE last_name IS NULL
    `);
    await queryInterface.changeColumn('user_account', 'last_name', {
      type: Sequelize.STRING(100),
      allowNull: false,
    });
  },
};
