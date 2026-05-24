'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('job_title', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      tenant_id: { type: Sequelize.INTEGER, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
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
    await queryInterface.addIndex('job_title', ['tenant_id', 'name'], {
      unique: true,
      name: 'job_title_tenant_name_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('job_title');
  },
};
