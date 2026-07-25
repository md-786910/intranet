'use strict';

/**
 * READ-ONLY: print Entra directory user counts.
 * Does NOT sync, create, update, or delete any BrightNow / Entra users.
 *
 * Usage:
 *   node scripts/count-entra-directory.js
 *
 * Or: npm run count:entra
 */

require('../config/env');

async function main() {
  // Intentionally does not load entra-sync or syncUsersFromEntra.
  const { getEntraDirectoryCounts } = require('../modules/azure-ad/azure-ad.service');
  const counts = await getEntraDirectoryCounts();
  console.log(JSON.stringify({
    source: 'Microsoft Entra ID (Graph GET /users — read only)',
    sync: false,
    ...counts,
  }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
