'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('news_item', {
      news_item_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      summary: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      body: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cover_image_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cover_image_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'media_asset', key: 'media_asset_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      status: {
        type: Sequelize.ENUM('DRAFT', 'PUBLISHED', 'ARCHIVED'),
        defaultValue: 'DRAFT',
        allowNull: false,
      },
      author_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      owning_scope_type: {
        type: Sequelize.ENUM('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'),
        allowNull: false,
      },
      owning_scope_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      published_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      archived_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    await queryInterface.addIndex('news_item', ['tenant_id', 'status'], {
      name: 'news_item_tenant_status_idx',
    });
    await queryInterface.addIndex('news_item', ['author_id'], {
      name: 'news_item_author_idx',
    });
    await queryInterface.addIndex('news_item', ['owning_scope_type', 'owning_scope_id'], {
      name: 'news_item_scope_idx',
    });
    await queryInterface.addIndex('news_item', ['slug'], {
      name: 'news_item_slug_idx',
    });
    await queryInterface.addIndex('news_item', ['deleted_at'], {
      name: 'news_item_deleted_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('news_item');
  },
};
