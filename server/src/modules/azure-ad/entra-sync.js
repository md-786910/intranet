'use strict';

/**
 * Shared Entra → BrightNow user sync.
 * Used by CLI (`scripts/sync-entra-users.js`) and thin POST /azure-ad/sync-users.
 *
 * - Match by azure_object_id, else email
 * - Store Entra department → person_profile.department_display
 * - Store Entra jobTitle → job_title catalog + person_profile.job_title
 * - App role always EMPLOYEE at ORGANISATION (no org-tree / department placement)
 * - Admin attaches teams later via Organisation Tree
 * - Never sends email
 * - New users get default password new@12345 (overrideable via options.password)
 */

const logger = require('../../config/logger');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const organisationContextService = require('../../services/organisation-context.service');

/** Default password for every user created by Entra sync */
const DEFAULT_CREATE_PASSWORD = 'new@12345';

async function resolveEmployeeRoleCategoryId() {
  const { RoleCategory } = require('../../database/models');
  const row = await RoleCategory.findOne({
    where: { name: 'Employee', tenant_id: DEFAULT_TENANT_ID },
    attributes: ['id'],
  });
  return row ? row.id : null;
}

async function resolveEmployeeRoleId() {
  const { Role } = require('../../database/models');
  const role = await Role.findOne({ where: { code: 'EMPLOYEE', tenant_id: DEFAULT_TENANT_ID } });
  if (!role) {
    throw Object.assign(new Error('EMPLOYEE role is not seeded'), {
      statusCode: 500,
      isOperational: true,
    });
  }
  return role.role_id;
}

/** Upsert Entra job title into job_title catalog; returns the display name to store on profile. */
async function ensureJobTitle(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const { JobTitle } = require('../../database/models');
  const [row] = await JobTitle.findOrCreate({
    where: { tenant_id: DEFAULT_TENANT_ID, name: trimmed.slice(0, 100) },
    defaults: { tenant_id: DEFAULT_TENANT_ID, name: trimmed.slice(0, 100) },
  });
  return row.name;
}

/** Ensure EMPLOYEE @ ORGANISATION without touching org-tree memberships. */
async function ensureEmployeeAtOrganisation({ userId, organisationId, actorUserId }) {
  const { UserRoleAssignment } = require('../../database/models');
  const roleId = await resolveEmployeeRoleId();
  const existing = await UserRoleAssignment.findOne({
    where: {
      user_id: userId,
      role_id: roleId,
      scope_type: 'ORGANISATION',
      scope_id: organisationId,
    },
  });
  if (!existing) {
    await UserRoleAssignment.create({
      user_id: userId,
      role_id: roleId,
      scope_type: 'ORGANISATION',
      scope_id: organisationId,
      assigned_by: actorUserId || null,
    });
  }
}

function resolveEmail(graphUser) {
  const raw = (graphUser.mail || graphUser.userPrincipalName || '').trim().toLowerCase();
  if (!raw || !raw.includes('@')) return null;
  return raw;
}

function resolveNames(graphUser) {
  let first = (graphUser.givenName || '').trim();
  let last = (graphUser.surname || '').trim();
  if (!first && !last && graphUser.displayName) {
    const parts = String(graphUser.displayName).trim().split(/\s+/).filter(Boolean);
    first = parts[0] || 'User';
    last = parts.slice(1).join(' ') || 'Unknown';
  }
  if (!first) first = 'User';
  if (!last) last = 'Unknown';
  return { first_name: first.slice(0, 100), last_name: last.slice(0, 100) };
}

function resolvePhone(graphUser) {
  const mobile = (graphUser.mobilePhone || '').trim();
  if (mobile) return mobile.slice(0, 20);
  const business = Array.isArray(graphUser.businessPhones) ? graphUser.businessPhones[0] : null;
  if (business) return String(business).trim().slice(0, 20);
  return null;
}

function resolveHireDate(graphUser) {
  if (!graphUser.employeeHireDate) return null;
  const s = String(graphUser.employeeHireDate);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

async function findLocalUser({ email, azureObjectId }) {
  const { UserAccount } = require('../../database/models');
  if (azureObjectId) {
    const byAzure = await UserAccount.findOne({
      where: { azure_object_id: azureObjectId },
      attributes: ['user_id', 'email', 'azure_object_id'],
    });
    if (byAzure) return byAzure;
  }
  if (email) {
    return UserAccount.findOne({
      where: { email: String(email).toLowerCase() },
      attributes: ['user_id', 'email', 'azure_object_id'],
    });
  }
  return null;
}

/**
 * Two-pass Entra → BrightNow sync.
 * No org-tree placement — department/job title stored on profile; EMPLOYEE @ ORGANISATION only.
 */
async function syncUsersFromEntra({ dryRun = false, onlyEnabled = true, password } = {}, actorUserId) {
  const usersService = require('../users/users.service');
  const { UserAccount } = require('../../database/models');
  const { fetchGraphUsersForSync } = require('./azure-ad.service');

  const plainPassword = (password && String(password).trim())
    ? String(password).trim()
    : DEFAULT_CREATE_PASSWORD;

  const [graphUsers, roleCategoryId, employeeRoleId, organisationId] = await Promise.all([
    fetchGraphUsersForSync({ onlyEnabled }),
    resolveEmployeeRoleCategoryId(),
    resolveEmployeeRoleId(),
    organisationContextService.getCurrentOrganisationId(),
  ]);

  const summary = {
    dry_run: Boolean(dryRun),
    total_graph: graphUsers.length,
    created: 0,
    updated: 0,
    skipped: 0,
    job_titles_ensured: 0,
    reporting_linked: 0,
    errors: [],
    samples: [],
  };

  const azureToLocal = new Map();
  const azureManager = new Map();
  const ensuredJobTitles = new Set();

  for (const gu of graphUsers) {
    const email = resolveEmail(gu);
    const { first_name, last_name } = resolveNames(gu);
    const deptName = (gu.department || '').trim() || null;
    const rawJobTitle = (gu.jobTitle || '').trim() || null;

    const preview = {
      azure_id: gu.id,
      email,
      displayName: gu.displayName || `${first_name} ${last_name}`,
      jobTitle: rawJobTitle,
      department: deptName,
      role: 'EMPLOYEE',
      org_placement: 'skipped (admin later)',
      manager_azure_id: gu._managerId || null,
      action: null,
    };

    if (!email) {
      summary.skipped += 1;
      summary.errors.push({ azure_id: gu.id, reason: 'No usable email / UPN' });
      preview.action = 'skip';
      if (summary.samples.length < 25) summary.samples.push(preview);
      continue;
    }

    if (gu._managerId) azureManager.set(gu.id, gu._managerId);

    if (dryRun) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await findLocalUser({ email, azureObjectId: gu.id });
      if (existing) {
        summary.updated += 1;
        preview.action = 'update';
        azureToLocal.set(gu.id, existing.user_id);
      } else if (plainPassword) {
        summary.created += 1;
        preview.action = 'create';
        azureToLocal.set(gu.id, -1);
      } else {
        summary.skipped += 1;
        preview.action = 'skip_create_no_password';
      }
      if (rawJobTitle) ensuredJobTitles.add(rawJobTitle.toLowerCase());
      if (summary.samples.length < 25) summary.samples.push(preview);
      continue;
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      const jobTitle = await ensureJobTitle(rawJobTitle);
      if (jobTitle && !ensuredJobTitles.has(jobTitle.toLowerCase())) {
        ensuredJobTitles.add(jobTitle.toLowerCase());
        summary.job_titles_ensured += 1;
      }

      // eslint-disable-next-line no-await-in-loop
      const existing = await findLocalUser({ email, azureObjectId: gu.id });
      const profile = {
        job_title: jobTitle,
        employee_id: gu.employeeId || null,
        department_display: deptName,
        location: gu.officeLocation || null,
        date_of_joining: resolveHireDate(gu),
      };

      if (existing) {
        // eslint-disable-next-line no-await-in-loop
        await usersService.update(existing.user_id, {
          first_name,
          last_name,
          phone: resolvePhone(gu),
          azure_object_id: gu.id,
          role_category_id: roleCategoryId || undefined,
          profile,
        }, actorUserId);

        // Keep EMPLOYEE app role; do not attach org-tree nodes
        // eslint-disable-next-line no-await-in-loop
        await ensureEmployeeAtOrganisation({
          userId: existing.user_id,
          organisationId,
          actorUserId,
        });

        summary.updated += 1;
        preview.action = 'update';
        azureToLocal.set(gu.id, existing.user_id);
      } else if (plainPassword) {
        // eslint-disable-next-line no-await-in-loop
        const created = await usersService.create({
          email,
          password: plainPassword,
          first_name,
          last_name,
          phone: resolvePhone(gu),
          azure_object_id: gu.id,
          role_category_id: roleCategoryId || undefined,
          // No department_ids / org-tree — admin places later
          initial_roles: [{
            role_id: employeeRoleId,
            scope_type: 'ORGANISATION',
            scope_id: organisationId,
          }],
          profile,
          skip_email: true,
        }, actorUserId);

        summary.created += 1;
        preview.action = 'create';
        azureToLocal.set(gu.id, created.user_id);
      } else {
        summary.skipped += 1;
        preview.action = 'skip_create_no_password';
        summary.errors.push({
          azure_id: gu.id,
          email,
          reason: 'Not in BrightNow — provide a temp password to create',
        });
      }
      if (summary.samples.length < 25) summary.samples.push(preview);
    } catch (err) {
      summary.skipped += 1;
      summary.errors.push({
        azure_id: gu.id,
        email,
        reason: err.message || 'Sync failed',
      });
      logger.warn(`Entra sync failed for ${email || gu.id}: ${err.message}`);
    }
  }

  summary.job_titles_ensured = ensuredJobTitles.size;

  async function resolveLocalUserId(azureId) {
    if (!azureId) return null;
    if (azureToLocal.has(azureId)) {
      const id = azureToLocal.get(azureId);
      return id > 0 ? id : null;
    }
    const row = await UserAccount.findOne({
      where: { azure_object_id: azureId },
      attributes: ['user_id'],
    });
    return row ? row.user_id : null;
  }

  if (!dryRun) {
    for (const [azureId, managerAzureId] of azureManager.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const localId = await resolveLocalUserId(azureId);
      // eslint-disable-next-line no-await-in-loop
      const managerLocalId = await resolveLocalUserId(managerAzureId);
      if (!localId || !managerLocalId || localId === managerLocalId) continue;
      try {
        // eslint-disable-next-line no-await-in-loop
        await usersService.update(localId, { reports_to_user_id: managerLocalId }, actorUserId);
        summary.reporting_linked += 1;
      } catch (err) {
        summary.errors.push({
          azure_id: azureId,
          reason: `Reporting link failed: ${err.message}`,
        });
      }
    }
  } else {
    for (const [azureId, managerAzureId] of azureManager.entries()) {
      if (azureToLocal.has(azureId) && azureToLocal.has(managerAzureId)) {
        summary.reporting_linked += 1;
      }
    }
  }

  return summary;
}

module.exports = {
  syncUsersFromEntra,
  DEFAULT_CREATE_PASSWORD,
};
