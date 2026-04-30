'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('document_version', 'files', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });

    // Backfill: build a single-element array from the legacy single-file columns
    // so existing versions render the same way once the UI switches to the array.
    await queryInterface.sequelize.query(`
      UPDATE document_version
      SET files = jsonb_build_array(
        jsonb_build_object(
          'url',  file_url,
          'name', file_name,
          'size', file_size,
          'mime', mime_type,
          'source', CASE WHEN media_asset_id IS NOT NULL THEN 'upload' ELSE 'url' END
        )
      )
      WHERE file_url IS NOT NULL AND file_url <> '' AND (files IS NULL OR jsonb_array_length(files) = 0);
    `);

    await queryInterface.addIndex('document_version', ['files'], {
      name: 'document_version_files_gin',
      using: 'GIN',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('document_version', 'document_version_files_gin').catch(() => {});
    await queryInterface.removeColumn('document_version', 'files');
  },
};
