'use strict';

// Backfill the MANAGE_EMPLOYEES action for existing databases where the initial
// seeders have already run. Grants the new action to OWNER (system, all-access)
// and OFFICE_MANAGER, mirroring the seeder definitions.

module.exports = {
  async up(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;

    const [adminModule] = await queryInterface.sequelize.query(
      "SELECT module_id FROM module WHERE code = 'ADMIN' LIMIT 1",
      { type: QueryTypes.SELECT },
    );
    if (!adminModule) {
      // Fresh DB without seed data; nothing to backfill.
      return;
    }

    const adminModuleId = adminModule.module_id;

    // 1. Ensure the module_action row exists
    const [existingAction] = await queryInterface.sequelize.query(
      `SELECT module_action_id FROM module_action
         WHERE module_id = :moduleId AND action_code = 'MANAGE_EMPLOYEES' LIMIT 1`,
      { replacements: { moduleId: adminModuleId }, type: QueryTypes.SELECT },
    );

    let manageEmployeesActionId;
    if (existingAction) {
      manageEmployeesActionId = existingAction.module_action_id;
    } else {
      const now = new Date();
      await queryInterface.bulkInsert('module_action', [{
        module_id: adminModuleId,
        action_code: 'MANAGE_EMPLOYEES',
        name: 'Manage Employees',
        created_at: now,
        updated_at: now,
      }]);
      const [inserted] = await queryInterface.sequelize.query(
        `SELECT module_action_id FROM module_action
           WHERE module_id = :moduleId AND action_code = 'MANAGE_EMPLOYEES' LIMIT 1`,
        { replacements: { moduleId: adminModuleId }, type: QueryTypes.SELECT },
      );
      manageEmployeesActionId = inserted.module_action_id;
    }

    // 2. Grant to roles that should have it (OWNER + OFFICE_MANAGER).
    //    INSERT ... SELECT ... WHERE NOT EXISTS keeps it idempotent.
    await queryInterface.sequelize.query(
      `INSERT INTO role_permission (role_id, module_action_id, effect, created_at, updated_at)
       SELECT r.role_id, :actionId, 'ALLOW', NOW(), NOW()
         FROM role r
        WHERE r.code IN ('OWNER', 'OFFICE_MANAGER')
          AND NOT EXISTS (
            SELECT 1 FROM role_permission rp
             WHERE rp.role_id = r.role_id
               AND rp.module_action_id = :actionId
          )`,
      { replacements: { actionId: manageEmployeesActionId } },
    );
  },

  async down(queryInterface, Sequelize) {
    const { QueryTypes } = Sequelize;
    const [row] = await queryInterface.sequelize.query(
      `SELECT ma.module_action_id FROM module_action ma
         JOIN module m ON m.module_id = ma.module_id
        WHERE m.code = 'ADMIN' AND ma.action_code = 'MANAGE_EMPLOYEES' LIMIT 1`,
      { type: QueryTypes.SELECT },
    );
    if (!row) return;

    await queryInterface.sequelize.query(
      'DELETE FROM role_permission WHERE module_action_id = :actionId',
      { replacements: { actionId: row.module_action_id } },
    );
    await queryInterface.sequelize.query(
      'DELETE FROM module_action WHERE module_action_id = :actionId',
      { replacements: { actionId: row.module_action_id } },
    );
  },
};
