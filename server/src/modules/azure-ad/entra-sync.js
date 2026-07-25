'use strict';

/**
 * Shared Entra → BrightNow user sync.
 * Used by CLI (`scripts/sync-entra-users.js`) and thin POST /azure-ad/sync-users.
 *
 * - Match by azure_object_id, else email
 * - jobTitle → job_title catalog + person_profile.job_title
 * - companyName / officeLocation → match existing COMPANY / OFFICE_LOCATION nodes (no auto-create)
 * - Raw company_name / location always stored from Entra when present
 * - department → find or create org_node DEPARTMENT, link node_membership + EMPLOYEE
 * - department_display always stored from Entra string
 * - manager → reports_to_user_id (azure id, then email)
 * - No null wipes of existing local fields when Graph is empty
 * - Default create password: new@12345; never sends email
 */

const logger = require('../../config/logger');
const { DEFAULT_TENANT_ID, MEMBER_BEARING_NODE_TYPES } = require('../../utils/constants');
const organisationContextService = require('../../services/organisation-context.service');
const hierarchyService = require('../../services/hierarchy.service');
const cacheService = require('../../services/cache.service');

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

async function resolveGroupRoot() {
  const { OrgNode } = require('../../database/models');
  const root = await OrgNode.findOne({
    where: { node_type: 'GROUP', parent_id: null, status: 'ACTIVE' },
    attributes: ['id', 'name', 'node_type', 'organisation_id'],
    order: [['id', 'ASC']],
  });
  if (!root) {
    throw Object.assign(new Error('No GROUP root org node found — run org backfill first'), {
      statusCode: 500,
      isOperational: true,
    });
  }
  return root;
}

/** Upsert Entra job title into job_title catalog (rank is required). */
async function ensureJobTitle(name) {
  const { formatJobTitleName } = require('../../utils/jobTitleFormat');
  const title = formatJobTitleName(name);
  if (!title) return null;
  const { JobTitle, sequelize } = require('../../database/models');
  const { Op } = require('sequelize');

  const existing = await JobTitle.findOne({
    where: {
      tenant_id: DEFAULT_TENANT_ID,
      [Op.and]: sequelize.where(
        sequelize.fn('LOWER', sequelize.col('name')),
        title.toLowerCase(),
      ),
    },
  });
  if (existing) {
    if (existing.name !== title) {
      await existing.update({ name: title });
    }
    return existing.name;
  }

  const maxRank = await JobTitle.max('rank', { where: { tenant_id: DEFAULT_TENANT_ID } });
  const [row] = await JobTitle.findOrCreate({
    where: { tenant_id: DEFAULT_TENANT_ID, name: title },
    defaults: {
      tenant_id: DEFAULT_TENANT_ID,
      name: title,
      rank: (maxRank || 0) + 1,
    },
  });
  return row.name;
}

/**
 * Find org_node by exact case-insensitive name and type. No create.
 */
async function findOrgNodeByName(name, nodeType) {
  const trimmed = (name || '').trim();
  if (!trimmed) return null;
  const { OrgNode } = require('../../database/models');
  const { Op } = require('sequelize');
  const key = trimmed.toLowerCase();

  const rows = await OrgNode.findAll({
    where: {
      status: 'ACTIVE',
      node_type: nodeType,
      name: { [Op.iLike]: trimmed },
    },
    attributes: ['id', 'name', 'node_type', 'organisation_id', 'parent_id'],
    order: [['id', 'ASC']],
  });
  const match = rows.find((n) => String(n.name).trim().toLowerCase() === key);
  return match || null;
}

/**
 * Find org_node by department name (case-insensitive), or create DEPARTMENT under GROUP.
 * Returns { node, created }.
 */
async function ensureDepartmentNode(deptName, groupRoot) {
  const trimmed = (deptName || '').trim();
  if (!trimmed) return { node: null, created: false };

  const { OrgNode, sequelize } = require('../../database/models');
  const { Op } = require('sequelize');
  const key = trimmed.toLowerCase();

  const existing = await OrgNode.findAll({
    where: {
      status: 'ACTIVE',
      node_type: MEMBER_BEARING_NODE_TYPES,
      name: { [Op.iLike]: trimmed },
    },
    attributes: ['id', 'name', 'node_type', 'organisation_id', 'parent_id'],
  });

  // Prefer exact case-insensitive match; prefer DEPARTMENT type
  const matches = existing.filter((n) => String(n.name).trim().toLowerCase() === key);
  if (matches.length > 0) {
    matches.sort((a, b) => {
      if (a.node_type === 'DEPARTMENT' && b.node_type !== 'DEPARTMENT') return -1;
      if (b.node_type === 'DEPARTMENT' && a.node_type !== 'DEPARTMENT') return 1;
      return a.id - b.id;
    });
    return { node: matches[0], created: false };
  }

  const organisationId = groupRoot.organisation_id
    || await organisationContextService.getCurrentOrganisationId();

  const tx = await sequelize.transaction();
  try {
    const node = await hierarchyService.createNode({
      organisation_id: organisationId,
      parent_id: groupRoot.id,
      node_type: 'DEPARTMENT',
      name: trimmed.slice(0, 255),
      status: 'ACTIVE',
    }, tx);
    await tx.commit();
    await cacheService.deletePattern('bh:org:tree:*');
    organisationContextService.invalidateCache();
    logger.info(`Entra sync created DEPARTMENT org_node "${trimmed}" id=${node.id}`);
    return { node, created: true };
  } catch (err) {
    await tx.rollback();
    throw err;
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

function resolveBusinessPhone(graphUser) {
  const business = Array.isArray(graphUser.businessPhones) ? graphUser.businessPhones[0] : null;
  if (business) return String(business).trim().slice(0, 20);
  return null;
}

function resolveMobilePhone(graphUser) {
  const mobile = (graphUser.mobilePhone || '').trim();
  return mobile ? mobile.slice(0, 20) : null;
}

/** @deprecated use resolveBusinessPhone / resolveMobilePhone */
function resolvePhone(graphUser) {
  return resolveMobilePhone(graphUser) || resolveBusinessPhone(graphUser);
}

function resolveHireDate(graphUser) {
  if (!graphUser.employeeHireDate) return null;
  const s = String(graphUser.employeeHireDate);
  return s.length >= 10 ? s.slice(0, 10) : null;
}

function resolveOfficeLocation(graphUser) {
  const office = (graphUser.officeLocation || '').trim();
  return office ? office.slice(0, 255) : null;
}

/** Only set keys when value is non-empty (avoid wiping local data). */
function pickDefined(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
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

/** Save Entra profile photo to /uploads/avatars and return public URL, or null. */
async function syncAvatarFromEntra(azureObjectId, userId) {
  const fs = require('fs');
  const path = require('path');
  const { fetchUserPhoto } = require('./azure-ad.service');
  const photo = await fetchUserPhoto(azureObjectId);
  if (!photo?.buffer?.length) return null;

  const uploadRoot = path.join(__dirname, '..', '..', '..', 'uploads', 'avatars');
  if (!fs.existsSync(uploadRoot)) fs.mkdirSync(uploadRoot, { recursive: true });

  const fileName = `entra-${userId}.jpg`;
  const diskPath = path.join(uploadRoot, fileName);
  fs.writeFileSync(diskPath, photo.buffer);
  return `/uploads/avatars/${fileName}`;
}

async function syncUsersFromEntra({ dryRun = false, onlyEnabled = true, password } = {}, actorUserId) {
  const usersService = require('../users/users.service');
  const { UserAccount } = require('../../database/models');
  const { fetchGraphUsersForSync } = require('./azure-ad.service');

  const plainPassword = (password && String(password).trim())
    ? String(password).trim()
    : DEFAULT_CREATE_PASSWORD;

  const [graphUsers, roleCategoryId, employeeRoleId, groupRoot] = await Promise.all([
    fetchGraphUsersForSync({ onlyEnabled }),
    resolveEmployeeRoleCategoryId(),
    resolveEmployeeRoleId(),
    resolveGroupRoot(),
  ]);

  const summary = {
    dry_run: Boolean(dryRun),
    total_graph: graphUsers.length,
    created: 0,
    updated: 0,
    skipped: 0,
    job_titles_ensured: 0,
    departments_created: 0,
    departments_linked: 0,
    companies_matched: 0,
    offices_matched: 0,
    reporting_linked: 0,
    errors: [],
    samples: [],
  };

  const azureToLocal = new Map();
  const azureManager = new Map();
  const ensuredJobTitles = new Set();
  /** lower(deptName) → org_node */
  const deptNodeCache = new Map();
  /** `${type}:${lowerName}` → org_node|null */
  const namedNodeCache = new Map();

  async function cachedFindByName(name, nodeType) {
    const trimmed = (name || '').trim();
    if (!trimmed) return null;
    const key = `${nodeType}:${trimmed.toLowerCase()}`;
    if (namedNodeCache.has(key)) return namedNodeCache.get(key);
    const node = await findOrgNodeByName(trimmed, nodeType);
    namedNodeCache.set(key, node);
    return node;
  }

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
      manager_azure_id: gu._managerId || null,
      manager_email: gu._managerEmail || null,
      action: null,
      org_node: null,
    };

    if (!email) {
      summary.skipped += 1;
      summary.errors.push({ azure_id: gu.id, reason: 'No usable email / UPN' });
      preview.action = 'skip';
      if (summary.samples.length < 25) summary.samples.push(preview);
      continue;
    }

    if (gu._managerId) {
      azureManager.set(gu.id, {
        managerAzureId: gu._managerId,
        managerEmail: gu._managerEmail,
      });
    }

    if (dryRun) {
      // eslint-disable-next-line no-await-in-loop
      const existing = await findLocalUser({ email, azureObjectId: gu.id });
      if (existing) {
        summary.updated += 1;
        preview.action = 'update';
        azureToLocal.set(gu.id, existing.user_id);
      } else {
        summary.created += 1;
        preview.action = 'create';
        azureToLocal.set(gu.id, -1);
      }
      if (rawJobTitle) ensuredJobTitles.add(rawJobTitle.toLowerCase());
      if (deptName) preview.org_node = '(match or create DEPARTMENT)';
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

      let attachNode = null;
      if (deptName) {
        const cacheKey = deptName.toLowerCase();
        if (deptNodeCache.has(cacheKey)) {
          attachNode = deptNodeCache.get(cacheKey);
        } else {
          // eslint-disable-next-line no-await-in-loop
          const { node, created } = await ensureDepartmentNode(deptName, groupRoot);
          attachNode = node;
          deptNodeCache.set(cacheKey, node);
          if (created) summary.departments_created += 1;
        }
        preview.org_node = attachNode
          ? `${attachNode.node_type}:${attachNode.id}:${attachNode.name}`
          : null;
      }

      const scopeNodeId = attachNode ? Number(attachNode.id) : Number(groupRoot.id);

      // eslint-disable-next-line no-await-in-loop
      const existing = await findLocalUser({ email, azureObjectId: gu.id });

      const companyName = (gu.companyName || '').trim() || null;
      const officeName = resolveOfficeLocation(gu);

      // Prefer COMPANY match; fall back to GROUP root (organisation)
      // eslint-disable-next-line no-await-in-loop
      let companyNode = await cachedFindByName(companyName, 'COMPANY');
      if (!companyNode && companyName) {
        // eslint-disable-next-line no-await-in-loop
        companyNode = await cachedFindByName(companyName, 'GROUP');
      }
      // eslint-disable-next-line no-await-in-loop
      const officeNode = await cachedFindByName(officeName, 'OFFICE_LOCATION');

      const profile = pickDefined({
        job_title: jobTitle,
        employee_id: gu.employeeId || null,
        employee_type: (gu.employeeType || '').trim() || null,
        company_name: companyName,
        department_display: deptName,
        location: officeName,
        date_of_joining: resolveHireDate(gu),
        company_node_id: companyNode ? Number(companyNode.id) : undefined,
        office_node_id: officeNode ? Number(officeNode.id) : undefined,
      });

      const phone = resolveBusinessPhone(gu);
      const mobilePhone = resolveMobilePhone(gu);
      const accountPatch = pickDefined({
        first_name,
        last_name,
        phone,
        mobile_phone: mobilePhone,
        azure_object_id: gu.id,
      });

      let localUserId = null;

      if (existing) {
        // eslint-disable-next-line no-await-in-loop
        await usersService.update(existing.user_id, {
          ...accountPatch,
          role_category_id: roleCategoryId || undefined,
          profile,
        }, actorUserId);

        localUserId = existing.user_id;
        // eslint-disable-next-line no-await-in-loop
        await usersService.ensureEmployeeAtNode({
          userId: localUserId,
          nodeId: scopeNodeId,
          actorUserId,
        });

        if (attachNode) summary.departments_linked += 1;
        summary.updated += 1;
        preview.action = 'update';
        azureToLocal.set(gu.id, existing.user_id);
      } else {
        // eslint-disable-next-line no-await-in-loop
        const created = await usersService.create({
          email,
          password: plainPassword,
          first_name,
          last_name,
          phone: phone || undefined,
          mobile_phone: mobilePhone || undefined,
          azure_object_id: gu.id,
          role_category_id: roleCategoryId || undefined,
          department_ids: [scopeNodeId],
          primary_department_id: scopeNodeId,
          profile,
          skip_email: true,
        }, actorUserId);

        localUserId = created.user_id;
        // eslint-disable-next-line no-await-in-loop
        await usersService.ensureEmployeeAtNode({
          userId: localUserId,
          nodeId: scopeNodeId,
          actorUserId,
        });

        if (attachNode) summary.departments_linked += 1;
        summary.created += 1;
        preview.action = 'create';
        azureToLocal.set(gu.id, created.user_id);
      }

      if (localUserId) {
        try {
          // eslint-disable-next-line no-await-in-loop
          const avatarUrl = await syncAvatarFromEntra(gu.id, localUserId);
          if (avatarUrl) {
            // eslint-disable-next-line no-await-in-loop
            await usersService.update(localUserId, { avatar_url: avatarUrl }, actorUserId);
          }
        } catch (photoErr) {
          logger.warn(`Entra photo sync skipped for ${email || gu.id}: ${photoErr.message}`);
        }
      }

      if (companyNode && localUserId) {
        // eslint-disable-next-line no-await-in-loop
        await usersService.ensureEmployeeAtNode({
          userId: localUserId,
          nodeId: Number(companyNode.id),
          actorUserId,
        });
        summary.companies_matched += 1;
      }
      if (officeNode && localUserId) {
        // eslint-disable-next-line no-await-in-loop
        await usersService.ensureEmployeeAtNode({
          userId: localUserId,
          nodeId: Number(officeNode.id),
          actorUserId,
        });
        summary.offices_matched += 1;
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

  async function resolveLocalUserId(azureId, emailHint) {
    if (azureId && azureToLocal.has(azureId)) {
      const id = azureToLocal.get(azureId);
      return id > 0 ? id : null;
    }
    if (azureId) {
      const byAzure = await UserAccount.findOne({
        where: { azure_object_id: azureId },
        attributes: ['user_id'],
      });
      if (byAzure) return byAzure.user_id;
    }
    if (emailHint) {
      const byEmail = await UserAccount.findOne({
        where: { email: String(emailHint).toLowerCase() },
        attributes: ['user_id'],
      });
      if (byEmail) return byEmail.user_id;
    }
    return null;
  }

  if (!dryRun) {
    for (const [azureId, { managerAzureId, managerEmail }] of azureManager.entries()) {
      // eslint-disable-next-line no-await-in-loop
      const localId = await resolveLocalUserId(azureId, null);
      // eslint-disable-next-line no-await-in-loop
      const managerLocalId = await resolveLocalUserId(managerAzureId, managerEmail);
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
    for (const [azureId, { managerAzureId }] of azureManager.entries()) {
      if (azureToLocal.has(azureId) && azureToLocal.has(managerAzureId)) {
        summary.reporting_linked += 1;
      }
    }
  }

  return summary;
}

/**
 * Pull one Entra user (by local BrightNow user_id) and update that account.
 * Requires azure_object_id on the local user.
 */
async function syncLocalUserFromEntra({ userId }, actorUserId) {
  const ApiError = require('../../utils/ApiError');
  const usersService = require('../users/users.service');
  const { UserAccount } = require('../../database/models');
  const { fetchGraphUserForSync } = require('./azure-ad.service');

  const local = await UserAccount.findByPk(userId, {
    attributes: ['user_id', 'email', 'azure_object_id', 'first_name', 'last_name'],
  });
  if (!local) throw ApiError.notFound('User not found');
  if (!local.azure_object_id) {
    throw ApiError.badRequest('User is not linked to Entra — Azure Object ID is missing');
  }

  // Bust cached Graph detail so we pull fresh attributes
  await cacheService.del(`ad:user:${local.azure_object_id}`).catch(() => {});

  let gu;
  try {
    gu = await fetchGraphUserForSync(local.azure_object_id);
  } catch (err) {
    throw ApiError.badRequest(err.message || 'Failed to fetch user from Entra / Azure AD');
  }

  const [roleCategoryId, groupRoot] = await Promise.all([
    resolveEmployeeRoleCategoryId(),
    resolveGroupRoot(),
  ]);

  const email = resolveEmail(gu);
  const { first_name, last_name } = resolveNames(gu);
  const deptName = (gu.department || '').trim() || null;
  const rawJobTitle = (gu.jobTitle || '').trim() || null;
  const companyName = (gu.companyName || '').trim() || null;
  const officeName = resolveOfficeLocation(gu);

  const jobTitle = await ensureJobTitle(rawJobTitle);

  let attachNode = null;
  if (deptName) {
    const { node } = await ensureDepartmentNode(deptName, groupRoot);
    attachNode = node;
  }
  const scopeNodeId = attachNode ? Number(attachNode.id) : Number(groupRoot.id);

  let companyNode = await findOrgNodeByName(companyName, 'COMPANY');
  if (!companyNode && companyName) {
    companyNode = await findOrgNodeByName(companyName, 'GROUP');
  }
  const officeNode = await findOrgNodeByName(officeName, 'OFFICE_LOCATION');

  const profile = pickDefined({
    job_title: jobTitle,
    employee_id: gu.employeeId || null,
    employee_type: (gu.employeeType || '').trim() || null,
    company_name: companyName,
    department_display: deptName,
    location: officeName,
    date_of_joining: resolveHireDate(gu),
    company_node_id: companyNode ? Number(companyNode.id) : undefined,
    office_node_id: officeNode ? Number(officeNode.id) : undefined,
  });

  const phone = resolveBusinessPhone(gu);
  const mobilePhone = resolveMobilePhone(gu);
  const accountPatch = pickDefined({
    first_name,
    last_name,
    phone,
    mobile_phone: mobilePhone,
    azure_object_id: gu.id,
  });

  await usersService.update(local.user_id, {
    ...accountPatch,
    role_category_id: roleCategoryId || undefined,
    profile,
  }, actorUserId);

  try {
    const avatarUrl = await syncAvatarFromEntra(gu.id, local.user_id);
    if (avatarUrl) {
      await usersService.update(local.user_id, { avatar_url: avatarUrl }, actorUserId);
    }
  } catch (photoErr) {
    logger.warn(`Entra photo sync skipped for user ${local.user_id}: ${photoErr.message}`);
  }

  await usersService.ensureEmployeeAtNode({
    userId: local.user_id,
    nodeId: scopeNodeId,
    actorUserId,
  });
  if (companyNode) {
    await usersService.ensureEmployeeAtNode({
      userId: local.user_id,
      nodeId: Number(companyNode.id),
      actorUserId,
    });
  }
  if (officeNode) {
    await usersService.ensureEmployeeAtNode({
      userId: local.user_id,
      nodeId: Number(officeNode.id),
      actorUserId,
    });
  }

  // Manager → reports_to
  let reportingLinked = false;
  if (gu._managerId) {
    let managerLocal = await UserAccount.findOne({
      where: { azure_object_id: gu._managerId },
      attributes: ['user_id'],
    });
    if (!managerLocal && gu._managerEmail) {
      managerLocal = await UserAccount.findOne({
        where: { email: gu._managerEmail },
        attributes: ['user_id'],
      });
    }
    if (managerLocal && Number(managerLocal.user_id) !== Number(local.user_id)) {
      await usersService.update(local.user_id, {
        reports_to_user_id: managerLocal.user_id,
      }, actorUserId);
      reportingLinked = true;
    }
  }

  const updated = await usersService.getById(local.user_id);
  return {
    action: 'updated',
    user_id: local.user_id,
    email: email || local.email,
    azure_object_id: gu.id,
    company_matched: Boolean(companyNode),
    office_matched: Boolean(officeNode),
    department_linked: Boolean(attachNode),
    reporting_linked: reportingLinked,
    user: updated,
  };
}

module.exports = {
  syncUsersFromEntra,
  syncLocalUserFromEntra,
  DEFAULT_CREATE_PASSWORD,
};
