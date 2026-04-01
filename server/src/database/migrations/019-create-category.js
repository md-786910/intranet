'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('category', {
      category_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      tenant_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      slug: {
        type: Sequelize.STRING(300),
        allowNull: false,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      parent_category_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'category', key: 'category_id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      sort_order: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
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

    await queryInterface.addIndex('category', ['tenant_id'], {
      name: 'category_tenant_idx',
    });
    await queryInterface.addIndex('category', ['slug'], {
      name: 'category_slug_idx',
    });
    await queryInterface.addIndex('category', ['deleted_at'], {
      name: 'category_deleted_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('category');
  },
};
