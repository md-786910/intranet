'use strict';

// Module code -> action codes
const moduleActions = {
  NEWS: [
    { code: 'VIEW', name: 'View News' },
    { code: 'CREATE', name: 'Create News' },
    { code: 'EDIT', name: 'Edit News' },
    { code: 'DELETE', name: 'Delete News' },
    { code: 'PUBLISH', name: 'Publish News' },
  ],
  DOCUMENTS: [
    { code: 'VIEW', name: 'View Documents' },
    { code: 'CREATE', name: 'Create Documents' },
    { code: 'EDIT', name: 'Edit Documents' },
    { code: 'DELETE', name: 'Delete Documents' },
    { code: 'PUBLISH', name: 'Publish Documents' },
  ],
  PUSH: [
    { code: 'VIEW', name: 'View Push Campaigns' },
    { code: 'CREATE', name: 'Create Push Campaign' },
    { code: 'SEND', name: 'Send Push Campaign' },
    { code: 'CANCEL', name: 'Cancel Push Campaign' },
  ],
  DIRECTORY: [
    { code: 'VIEW', name: 'View Directory' },
    { code: 'EXPORT', name: 'Export Directory' },
    { code: 'MANAGE_PROFILE', name: 'Manage Profile' },
  ],
  SEARCH: [
    { code: 'QUERY', name: 'Search Content' },
  ],
  SAVED: [
    { code: 'VIEW', name: 'View Saved Items' },
    { code: 'SAVE', name: 'Save Items' },
    { code: 'REMOVE', name: 'Remove Saved Items' },
  ],
  ANALYTICS: [
    { code: 'VIEW', name: 'View Analytics' },
  ],
  ADMIN: [
    { code: 'MANAGE_OFFICE_LOCATIONS', name: 'Manage Office Locations' },
    { code: 'MANAGE_VERTICALS', name: 'Manage Verticals' },
    { code: 'MANAGE_DEPARTMENTS', name: 'Manage Departments' },
    { code: 'MANAGE_USERS', name: 'Manage Users' },
    { code: 'MANAGE_ROLES', name: 'Manage Roles' },
    { code: 'VIEW_ANALYTICS', name: 'View Admin Analytics' },
    { code: 'VIEW_AUDIT_LOG', name: 'View Audit Log' },
  ],
};

module.exports = {
  async up(queryInterface, Sequelize) {
    // Look up module IDs
    const modules = await queryInterface.sequelize.query(
      'SELECT module_id, code FROM module',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const moduleMap = {};
    modules.forEach((m) => { moduleMap[m.code] = m.module_id; });

    const now = new Date();
    const rows = [];

    Object.entries(moduleActions).forEach(([moduleCode, actions]) => {
      const moduleId = moduleMap[moduleCode];
      if (!moduleId) return;

      actions.forEach((action) => {
        rows.push({
          module_id: moduleId,
          action_code: action.code,
          name: action.name,
          created_at: now,
          updated_at: now,
        });
      });
    });

    await queryInterface.bulkInsert('module_action', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('module_action', null, {});
  },
};
