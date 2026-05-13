'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('category', 'creator_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'user_account', key: 'user_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    // Backfill existing categories to the first OWNER user so they remain
    // visible/manageable. Non-Owner users will only see categories they
    // create from now on; pre-existing rows stay owned by the platform.
    await queryInterface.sequelize.query(`
      UPDATE category
         SET creator_id = (
           SELECT ura.user_id
             FROM user_role_assignment ura
             JOIN role r ON r.role_id = ura.role_id
            WHERE r.code = 'OWNER'
            ORDER BY ura.user_id ASC
            LIMIT 1
         )
       WHERE creator_id IS NULL
    `);

    await queryInterface.addIndex('category', ['creator_id']);
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('category', ['creator_id']);
    await queryInterface.removeColumn('category', 'creator_id');
  },
};
