'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      UPDATE user_account
         SET deleted_at = NULL
       WHERE status = 'INACTIVE'
         AND deleted_at IS NOT NULL
    `);
  },

  async down() {
    // Intentionally no-op: we cannot recover the original deleted_at values.
  },
};
