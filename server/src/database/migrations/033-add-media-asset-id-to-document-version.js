'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_version', 'media_asset_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'media_asset', key: 'media_asset_id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });

    await queryInterface.addIndex('document_version', ['media_asset_id'], {
      name: 'document_version_media_asset_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('document_version', 'document_version_media_asset_idx').catch(() => {});
    await queryInterface.removeColumn('document_version', 'media_asset_id');
  },
};
