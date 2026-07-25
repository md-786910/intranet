'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('app_settings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        defaultValue: 1,
      },
      application_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'BrightNow',
      },
      meta_title: {
        type: Sequelize.STRING(100),
        allowNull: false,
        defaultValue: 'BrightNow',
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'user_account', key: 'user_id' },
        onDelete: 'SET NULL',
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

    await queryInterface.bulkInsert('app_settings', [{
      id: 1,
      application_name: 'BrightNow',
      meta_title: 'BrightNow',
      updated_by: null,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('app_settings');
  },
};
