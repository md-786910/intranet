'use strict';

// Adds 'ANNOUNCEMENT' as a valid entity_type on content_audience_rule so the
// Announcement module can store audience targeting rows alongside NEWS /
// DOCUMENT / PUSH using the same polymorphic table.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_content_audience_rule_entity_type\" ADD VALUE IF NOT EXISTS 'ANNOUNCEMENT'"
    );
  },

  async down() {
    // Postgres does not support removing values from an ENUM cleanly. No-op.
  },
};
