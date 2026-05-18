'use strict';

// Adds 'SCHEDULED' as a valid status on news_item, announcement_item,
// document_item — enables the "Publish Later" flow where content sits in a
// future-publish state until the periodic publisher flips it to PUBLISHED.

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_news_item_status\" ADD VALUE IF NOT EXISTS 'SCHEDULED'"
    );
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_announcement_item_status\" ADD VALUE IF NOT EXISTS 'SCHEDULED'"
    );
    await queryInterface.sequelize.query(
      "ALTER TYPE \"enum_document_item_status\" ADD VALUE IF NOT EXISTS 'SCHEDULED'"
    );
  },

  async down() {
    // Postgres cannot remove ENUM values cleanly. No-op.
  },
};
