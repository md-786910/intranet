"use strict";

/**
 * CLI: sync Entra (Azure AD) users into BrightNow.
 *
 * Usage:
 *   node scripts/sync-entra-users.js --dry-run
 *   node scripts/sync-entra-users.js
 *   node scripts/sync-entra-users.js --password=OtherPass
 *   node scripts/sync-entra-users.js --include-disabled
 *
 * Or: npm run sync:entra -- --dry-run
 *
 * New users are created with default password new@12345 (override with --password).
 * Existing users are updated; passwords are never changed; no emails are sent.
 */

require("../config/env");

const { sequelize } = require("../database/models");
const {
  syncUsersFromEntra,
  DEFAULT_CREATE_PASSWORD,
} = require("../modules/azure-ad/entra-sync");

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    onlyEnabled: true,
    password: DEFAULT_CREATE_PASSWORD,
  };

  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "-n") {
      opts.dryRun = true;
    } else if (arg === "--include-disabled") {
      opts.onlyEnabled = false;
    } else if (arg.startsWith("--password=")) {
      opts.password = arg.slice("--password=".length);
    } else if (arg === "--help" || arg === "-h") {
      opts.help = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(`Usage:
  node scripts/sync-entra-users.js --dry-run
  node scripts/sync-entra-users.js
  node scripts/sync-entra-users.js --password=<tempPassword>
  node scripts/sync-entra-users.js --include-disabled

Options:
  --dry-run              Preview only (no writes)
  --password=...         Override default create password (default: ${DEFAULT_CREATE_PASSWORD})
  --include-disabled     Include disabled Entra accounts (default: enabled only)
`);
    process.exit(0);
  }

  try {
    await sequelize.authenticate();
  } catch (err) {
    console.error(`Database connection failed: ${err.message}`);
    process.exit(1);
  }

  console.log(
    opts.dryRun ? "Running Entra sync dry-run…" : "Running Entra sync…",
  );
  if (!opts.dryRun) {
    console.log(
      `New users will use password: ${opts.password === DEFAULT_CREATE_PASSWORD ? "default (new@12345)" : "(custom --password)"}`,
    );
  }

  try {
    const summary = await syncUsersFromEntra(
      {
        dryRun: opts.dryRun,
        onlyEnabled: opts.onlyEnabled,
        password: opts.password,
      },
      null,
    );

    console.log(JSON.stringify(summary, null, 2));
    console.log(
      `\nDone: created=${summary.created} updated=${summary.updated} skipped=${summary.skipped} ` +
        `job_titles=${summary.job_titles_ensured} ` +
        `reporting_linked=${summary.reporting_linked} errors=${summary.errors.length}`,
    );
  } catch (err) {
    console.error(`Sync failed: ${err.message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
