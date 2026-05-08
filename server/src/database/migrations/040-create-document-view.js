'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('document_view', {
      view_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'user_account', key: 'user_id' },
        onDelete: 'CASCADE',
      },
      document_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'document_item', key: 'document_item_id' },
        onDelete: 'CASCADE',
      },
      viewed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('document_view', ['user_id', 'viewed_at']);
    await queryInterface.addIndex('document_view', ['user_id', 'document_item_id'], {
      unique: true,
      name: 'document_view_user_doc_unique',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('document_view');
  },
};
