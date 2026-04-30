"use strict";

// Role definitions with their permission sets
// Module:Action pairs that each role gets
const roleDefinitions = [
  {
    code: "OWNER",
    name: "Owner",
    description:
      "Full platform owner with all permissions. Cannot be deleted or renamed.",
    is_system: true,
    permissions: "ALL", // Special: gets every module_action
  },
  {
    code: "OFFICE_MANAGER",
    name: "Office Manager",
    description:
      "Manages office location including verticals, departments, users, and content.",
    is_system: false,
    permissions: [
      "ADMIN:MANAGE_VERTICALS",
      "ADMIN:MANAGE_DEPARTMENTS",
      "ADMIN:MANAGE_USERS",
      "ADMIN:MANAGE_EMPLOYEES",
      "ADMIN:VIEW_ANALYTICS",
      "NEWS:VIEW",
      "NEWS:CREATE",
      "NEWS:EDIT",
      "NEWS:DELETE",
      "NEWS:PUBLISH",
      "DOCUMENTS:VIEW",
      "DOCUMENTS:CREATE",
      "DOCUMENTS:EDIT",
      "DOCUMENTS:DELETE",
      "DOCUMENTS:PUBLISH",
      "PUSH:VIEW",
      "PUSH:CREATE",
      "PUSH:SEND",
      "PUSH:CANCEL",
      "DIRECTORY:VIEW",
      "DIRECTORY:MANAGE_PROFILE",
      "ANALYTICS:VIEW",
    ],
  },
  {
    code: "CONTENT_EDITOR",
    name: "Content Editor",
    description: "Creates and publishes news and document content.",
    is_system: false,
    permissions: [
      "NEWS:VIEW",
      "NEWS:CREATE",
      "NEWS:EDIT",
      "NEWS:PUBLISH",
      "DOCUMENTS:VIEW",
      "DOCUMENTS:CREATE",
      "DOCUMENTS:EDIT",
      "DOCUMENTS:PUBLISH",
      "DIRECTORY:VIEW",
    ],
  },
  {
    code: "EMPLOYEE",
    name: "Employee",
    description: "Standard employee with read access to content.",
    is_system: false,
    permissions: [
      "NEWS:VIEW",
      "DOCUMENTS:VIEW",
      "DIRECTORY:VIEW",
      "SEARCH:QUERY",
      "SAVED:VIEW",
      "SAVED:SAVE",
      "SAVED:REMOVE",
    ],
  },
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const TENANT_ID = 1;

    // Look up all module_actions to map "MODULE:ACTION" -> module_action_id
    const moduleActions = await queryInterface.sequelize.query(
      `
      SELECT ma.module_action_id, m.code AS module_code, ma.action_code
      FROM module_action ma
      JOIN module m ON m.module_id = ma.module_id
    `,
      { type: Sequelize.QueryTypes.SELECT },
    );

    const actionMap = {};
    moduleActions.forEach((ma) => {
      actionMap[`${ma.module_code}:${ma.action_code}`] = ma.module_action_id;
    });

    const allActionIds = moduleActions.map((ma) => ma.module_action_id);

    const now = new Date();

    // Insert roles one by one so we can capture auto-generated IDs
    for (const def of roleDefinitions) {
      await queryInterface.bulkInsert("role", [
        {
          tenant_id: TENANT_ID,
          code: def.code,
          name: def.name,
          description: def.description,
          is_system: def.is_system,
          created_by: null,
          deleted_at: null,
          created_at: now,
          updated_at: now,
        },
      ]);

      // Query back the role_id
      const [role] = await queryInterface.sequelize.query(
        `SELECT role_id FROM role WHERE code = '${def.code}' AND tenant_id = ${TENANT_ID} LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT },
      );

      const roleId = role.role_id;

      // Resolve permissions
      const targetActionIds =
        def.permissions === "ALL"
          ? allActionIds
          : def.permissions.map((key) => actionMap[key]).filter(Boolean);

      if (targetActionIds.length > 0) {
        const permissionRows = targetActionIds.map((moduleActionId) => ({
          role_id: roleId,
          module_action_id: moduleActionId,
          effect: "ALLOW",
          created_at: now,
          updated_at: now,
        }));
        await queryInterface.bulkInsert("role_permission", permissionRows);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete("role_permission", null, {});
    await queryInterface.bulkDelete("role", null, {});
  },
};
