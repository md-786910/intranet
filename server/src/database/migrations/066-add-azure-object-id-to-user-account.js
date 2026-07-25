'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('user_account');
    if (!table.azure_object_id) {
      await queryInterface.addColumn('user_account', 'azure_object_id', {
        type: Sequelize.STRING(64),
        allowNull: true,
      });
    }

    const [indexes] = await queryInterface.sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'user_account'
        AND (
          indexname = 'user_account_azure_object_id_unique'
          OR indexdef ILIKE '%(azure_object_id)%'
        )
    `);
    if (indexes.length === 0) {
      await queryInterface.addIndex('user_account', ['azure_object_id'], {
        unique: true,
        name: 'user_account_azure_object_id_unique',
      });
    }
  },

  async down(queryInterface) {
    const [indexes] = await queryInterface.sequelize.query(`
      SELECT indexname FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'user_account'
        AND indexname = 'user_account_azure_object_id_unique'
    `);
    if (indexes.length > 0) {
      await queryInterface.removeIndex('user_account', 'user_account_azure_object_id_unique');
    }

    const table = await queryInterface.describeTable('user_account');
    if (table.azure_object_id) {
      await queryInterface.removeColumn('user_account', 'azure_object_id');
    }
  },
};
