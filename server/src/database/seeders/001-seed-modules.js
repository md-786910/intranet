'use strict';

const modules = [
  { code: 'NEWS', name: 'News', description: 'News articles and announcements' },
  { code: 'DOCUMENTS', name: 'Documents', description: 'Document management and versioning' },
  { code: 'PUSH', name: 'Push Notifications', description: 'Push notification campaigns' },
  { code: 'DIRECTORY', name: 'Directory', description: 'Employee directory' },
  { code: 'SEARCH', name: 'Search', description: 'Content search' },
  { code: 'SAVED', name: 'Saved Items', description: 'User bookmarks and saved items' },
  { code: 'ANALYTICS', name: 'Analytics', description: 'Usage analytics and reports' },
  { code: 'ADMIN', name: 'Administration', description: 'Platform administration' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('module', modules.map((m) => ({
      code: m.code,
      name: m.name,
      description: m.description,
      is_active: true,
      created_at: now,
      updated_at: now,
    })));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('module', null, {});
  },
};
