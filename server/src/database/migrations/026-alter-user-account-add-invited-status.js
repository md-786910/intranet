'use strict';

module.exports = {
  async up(queryInterface) {
    // PostgreSQL: add INVITED value to the existing enum
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_user_account_status\" ADD VALUE IF NOT EXISTS 'INVITED'"
    );
  },

  async down() {
    // PostgreSQL does not support removing enum values without recreating the type.
    // Leaving INVITED in place on down-migrate is safe and matches common practice.
  },
};
