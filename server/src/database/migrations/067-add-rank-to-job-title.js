'use strict';

/** Align job_title with live schema: rank (required) + optional description. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('job_title');

    if (!table.rank) {
      await queryInterface.addColumn('job_title', 'rank', {
        type: Sequelize.INTEGER,
        allowNull: true,
      });
      await queryInterface.sequelize.query(`
        UPDATE job_title jt
        SET rank = sub.rn
        FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY tenant_id ORDER BY id) AS rn
          FROM job_title
        ) sub
        WHERE jt.id = sub.id AND jt.rank IS NULL
      `);
      await queryInterface.changeColumn('job_title', 'rank', {
        type: Sequelize.INTEGER,
        allowNull: false,
      });
    }

    if (!table.description) {
      await queryInterface.addColumn('job_title', 'description', {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('job_title');
    if (table.description) {
      await queryInterface.removeColumn('job_title', 'description');
    }
    if (table.rank) {
      await queryInterface.removeColumn('job_title', 'rank');
    }
  },
};
