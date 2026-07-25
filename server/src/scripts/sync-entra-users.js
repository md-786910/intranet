"use strict";

/**
 * CLI: sync Entra (Azure AD) users into BrightNow.
 *
 * Usage:
 *   node scripts/sync-entra-users.js --dry-run
 *   node scripts/sync-entra-users.js
 *   node scripts/sync-entra-users.js --password=OtherPass1!
 *   node scripts/sync-entra-users.js --include-disabled
 *
 * Or: npm run sync:entra -- --dry-run
 *
 * New users get an admin --password or a strong auto-generated temp password,
 * and must_change_password=true. Existing users are updated; passwords are never
 * changed; no emails are sent.
 */

require("../config/env");

const { sequelize } = require("../database/models");
const { syncUsersFromEntra } = require("../modules/azure-ad/entra-sync");

function parseArgs(argv) {
  const opts = {
    dryRun: false,
    onlyEnabled: true,
    password: null,
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
  --password=...         Temp create password (8+ chars, upper/lower/digit/special).
                         If omitted, a strong password is generated per new user.
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
      opts.password
        ? "New users will use the provided --password (must change on first login)."
        : "New users will get auto-generated temp passwords (must change on first login).",
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

    // Avoid dumping temp passwords to console by default — print a short note.
    const { temp_passwords: tempPasswords, ...safeSummary } = summary;
    console.log(JSON.stringify(safeSummary, null, 2));
    if (Array.isArray(tempPasswords) && tempPasswords.length > 0) {
      console.log(
        `\n${tempPasswords.length} auto-generated temp password(s) — not printed. ` +
          "Use the admin Sync UI to view them once, or pass --password=...",
      );
    }
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
