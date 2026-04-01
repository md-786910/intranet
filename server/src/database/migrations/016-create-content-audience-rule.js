'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('content_audience_rule', {
      audience_rule_id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      entity_type: {
        type: Sequelize.ENUM('NEWS', 'DOCUMENT', 'PUSH'),
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      target_org_unit_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'org_unit', key: 'org_unit_id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
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

    await queryInterface.addIndex('content_audience_rule', ['entity_type', 'entity_id'], {
      name: 'content_audience_rule_entity_idx',
    });
    await queryInterface.addIndex('content_audience_rule', ['target_org_unit_id'], {
      name: 'content_audience_rule_target_idx',
    });
    await queryInterface.addIndex('content_audience_rule', ['entity_type', 'entity_id', 'target_org_unit_id'], {
      unique: true,
      name: 'content_audience_rule_unique_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('content_audience_rule');
  },
};
