'use strict';

// Adds "who did the action" columns to news_item, document_item, category,
// and media_asset so the UI can surface a clean audit trail (created /
// updated / published / unpublished / archived / deleted by + when).
//
// All columns are nullable FKs to user_account.user_id with ON DELETE SET NULL
// so historical rows survive a user being deleted later.

async function addUserFk(queryInterface, Sequelize, table, column) {
  await queryInterface.addColumn(table, column, {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { model: 'user_account', key: 'user_id' },
    onUpdate: 'CASCADE',
    onDelete: 'SET NULL',
  });
}

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // news_item
    await addUserFk(queryInterface, Sequelize, 'news_item', 'updated_by');
    await addUserFk(queryInterface, Sequelize, 'news_item', 'published_by');
    await addUserFk(queryInterface, Sequelize, 'news_item', 'unpublished_by');
    await queryInterface.addColumn('news_item', 'unpublished_at', {
      type: Sequelize.DATE,
      allowNull: true,
    });
    await addUserFk(queryInterface, Sequelize, 'news_item', 'archived_by');
    // archived_at already exists from migration 016 — only need archived_by.
    await addUserFk(queryInterface, Sequelize, 'news_item', 'deleted_by');

    // document_item
    await addUserFk(queryInterface, Sequelize, 'document_item', 'updated_by');
    await addUserFk(queryInterface, Sequelize, 'document_item', 'published_by');
    await addUserFk(queryInterface, Sequelize, 'document_item', 'unpublished_by');
    await addUserFk(queryInterface, Sequelize, 'document_item', 'deleted_by');

    // category
    await addUserFk(queryInterface, Sequelize, 'category', 'updated_by');
    await addUserFk(queryInterface, Sequelize, 'category', 'deleted_by');

    // media_asset
    await addUserFk(queryInterface, Sequelize, 'media_asset', 'deleted_by');
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('media_asset', 'deleted_by');

    await queryInterface.removeColumn('category', 'deleted_by');
    await queryInterface.removeColumn('category', 'updated_by');

    await queryInterface.removeColumn('document_item', 'deleted_by');
    await queryInterface.removeColumn('document_item', 'unpublished_by');
    await queryInterface.removeColumn('document_item', 'published_by');
    await queryInterface.removeColumn('document_item', 'updated_by');

    await queryInterface.removeColumn('news_item', 'deleted_by');
    await queryInterface.removeColumn('news_item', 'archived_by');
    await queryInterface.removeColumn('news_item', 'unpublished_at');
    await queryInterface.removeColumn('news_item', 'unpublished_by');
    await queryInterface.removeColumn('news_item', 'published_by');
    await queryInterface.removeColumn('news_item', 'updated_by');
  },
};
