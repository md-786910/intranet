'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_version', {
      document_version_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      document_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'document_item', key: 'document_item_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      version_no: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      mime_type: {
        type: Sequelize.STRING(128),
        allowNull: true,
      },
      changelog: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
    });

    await queryInterface.addIndex('document_version', ['document_item_id', 'version_no'], {
      unique: true,
      name: 'document_version_doc_version_idx',
    });
    await queryInterface.addIndex('document_version', ['uploaded_by'], {
      name: 'document_version_uploader_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_version');
  },
};
