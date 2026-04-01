'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('media_asset', {
      media_asset_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      original_name: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(512),
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(128),
        allowNull: false,
      },
      size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      storage_path: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      alt_text: {
        type: Sequelize.STRING(512),
        allowNull: true,
      },
      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('media_asset', ['uploaded_by'], {
      name: 'media_asset_uploaded_by_idx',
    });
    await queryInterface.addIndex('media_asset', ['mime_type'], {
      name: 'media_asset_mime_type_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('media_asset');
  },
};
