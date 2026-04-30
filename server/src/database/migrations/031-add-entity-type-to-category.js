'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Add entity_type column with DEFAULT 'DOCUMENT' so existing rows
    //    (all of which were Document categories) are backfilled correctly.
    await queryInterface.addColumn('category', 'entity_type', {
      type: Sequelize.ENUM('NEWS', 'DOCUMENT'),
      allowNull: false,
      defaultValue: 'DOCUMENT',
    });

    // 2. Drop the default — new rows must specify entity_type explicitly
    //    so a missing value surfaces as a validation error rather than
    //    silently classifying as DOCUMENT.
    await queryInterface.sequelize.query(
      'ALTER TABLE "category" ALTER COLUMN "entity_type" DROP DEFAULT'
    );

    // 3. Slug is unique per (tenant, entity_type) — but only for live rows.
    //    A partial unique index lets a soft-deleted "newsletter" coexist
    //    with a live "newsletter" of the same entity type, and lets News
    //    and Documents both have a "newsletter".
    await queryInterface.sequelize.query(
      'CREATE UNIQUE INDEX "category_tenant_entity_slug_unique" '
      + 'ON "category" ("tenant_id", "entity_type", "slug") '
      + 'WHERE "deleted_at" IS NULL'
    );

    // 4. Helpful filter index — most queries scope by entity_type.
    await queryInterface.addIndex('category', ['entity_type'], {
      name: 'category_entity_type_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('category', 'category_entity_type_idx').catch(() => {});
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "category_tenant_entity_slug_unique"'
    );
    await queryInterface.removeColumn('category', 'entity_type');
    // Drop the auto-created enum type so the next up() can recreate it
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_category_entity_type"'
    );
  },
};
