'use strict';

const DEFAULT_TENANT_ID = 1;

const categories = [
  { name: 'CEO', rank: 1, description: 'Chief Executive Officer' },
  { name: 'VP', rank: 2, description: 'Vice President' },
  { name: 'Director', rank: 3, description: 'Director' },
  { name: 'Manager', rank: 4, description: 'Manager' },
  { name: 'Team Lead', rank: 5, description: 'Team Lead' },
  { name: 'Employee', rank: 6, description: 'Individual Contributor' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const rows = categories.map((c) => ({
      tenant_id: DEFAULT_TENANT_ID,
      name: c.name,
      rank: c.rank,
      description: c.description,
      created_at: now,
      updated_at: now,
    }));
    await queryInterface.bulkInsert('role_category', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('role_category', { tenant_id: DEFAULT_TENANT_ID }, {});
  },
};
