'use strict';

require('isomorphic-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const { ClientSecretCredential } = require('@azure/identity');
const cacheService = require('../../services/cache.service');
const logger = require('../../config/logger');

// ── TTLs ──────────────────────────────────────────────────────────────────────
const TTL_LIST   = 86400;  // 24 h – user list / search results
const TTL_DETAIL = 86400;  // 24 h – individual user + manager
const TTL_TREE   = 86400;  // 24 h – org tree flat list

// ── Lazy-initialised Graph client ─────────────────────────────────────────────
let _client = null;

function getGraphClient() {
  if (_client) return _client;

  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  if (!tenantId || !clientId || !clientSecret) {
    throw new Error('Azure AD credentials are not configured. Set AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET in .env');
  }

  const credential   = new ClientSecretCredential(tenantId, clientId, clientSecret);
  const authProvider = new TokenCredentialAuthenticationProvider(credential, {
    scopes: ['https://graph.microsoft.com/.default'],
  });

  _client = Client.initWithMiddleware({ authProvider });
  return _client;
}

// ── Wrap Graph errors with a clear human-readable message ─────────────────────
function wrapGraphError(err) {
  const code = err.statusCode || err.code;
  const make = (msg, status) => Object.assign(new Error(msg), { statusCode: status, isOperational: true });

  if (code === 401) {
    return make('Azure AD: invalid or expired credentials — check AZURE_CLIENT_SECRET in .env', 502);
  }
  if (code === 403) {
    // Log the raw Graph error body so admins can see the exact Microsoft error code
    logger.error('Graph API 403 body:', JSON.stringify(err.body || err.message));
    return make(
      'Azure AD 403: app registration is missing "User.Read.All" Application permission ' +
      'with admin consent, OR consent was added but the server needs a restart to get a fresh token.',
      502
    );
  }
  if (code === 404) {
    return make('Azure AD: resource not found', 404);
  }
  return make(`Azure AD error (${code}): ${err.message}`, 502);
}

// ── Shared $select for list views ─────────────────────────────────────────────
const LIST_SELECT = [
  'id', 'displayName', 'givenName', 'surname',
  'userPrincipalName', 'mail', 'jobTitle', 'department',
  'companyName', 'officeLocation', 'accountEnabled',
  'userType', 'createdDateTime',
].join(',');

// ── Full $select for detail view (matches Entra Properties tab) ───────────────
const DETAIL_SELECT = [
  'id', 'displayName', 'givenName', 'surname',
  'userPrincipalName', 'mail', 'jobTitle', 'department',
  'companyName', 'officeLocation', 'employeeId', 'employeeType',
  'employeeHireDate', 'businessPhones', 'mobilePhone',
  'streetAddress', 'city', 'state', 'postalCode', 'country',
  'usageLocation', 'accountEnabled', 'createdDateTime',
  'passwordPolicies', 'mailNickname', 'proxyAddresses',
  'imAddresses', 'preferredLanguage',
  'onPremisesSyncEnabled', 'onPremisesLastSyncDateTime',
  'onPremisesDistinguishedName', 'onPremisesImmutableId',
  'onPremisesSamAccountName', 'onPremisesProvisioningErrors',
  'userType', 'identities',
].join(',');

// ── Helper: fetch all pages from a Graph collection ───────────────────────────
async function fetchAllPages(initialRequest) {
  const client = getGraphClient();
  const results = [];
  try {
    let response = await client.api(initialRequest).get();
    while (true) {
      if (response.value) results.push(...response.value);
      if (!response['@odata.nextLink']) break;
      response = await client.api(response['@odata.nextLink']).get();
    }
  } catch (err) {
    throw wrapGraphError(err);
  }
  return results;
}

// ── Fetch & cache the full flat user list (used for list view + departments) ──
async function getAllUsersFlat() {
  const cacheKey = 'ad:all-users:v3';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const raw = await fetchAllPages(
    `/users?$select=${LIST_SELECT}&$expand=manager($select=id,displayName)&$top=999&$orderby=displayName`
  );

  // Keep only enabled accounts, then flatten manager into a simple string field
  const users = raw
    .filter((u) => u.accountEnabled !== false)
    .map(({ manager, ...u }) => ({
      ...u,
      _managerName: manager?.displayName || null,
    }));

  await cacheService.set(cacheKey, JSON.stringify(users), TTL_TREE);
  return users;
}

// ── 1. listUsers — paginated + filtered list for the table view ───────────────
async function listUsers({ search = '', department = '', accountEnabled, page = 1, limit = 50 } = {}) {
  let users = await getAllUsersFlat();

  // ── filter ──
  if (search) {
    const q = search.toLowerCase();
    users = users.filter(u =>
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.mail || '').toLowerCase().includes(q) ||
      (u.userPrincipalName || '').toLowerCase().includes(q) ||
      (u.jobTitle || '').toLowerCase().includes(q)
    );
  }

  if (department) {
    const d = department.toLowerCase();
    users = users.filter(u => (u.department || '').toLowerCase() === d);
  }

  if (accountEnabled !== undefined && accountEnabled !== '') {
    const enabled = accountEnabled === 'true' || accountEnabled === true;
    users = users.filter(u => u.accountEnabled === enabled);
  }

  // ── paginate ──
  const total = users.length;
  const offset = (Number(page) - 1) * Number(limit);
  const items  = users.slice(offset, offset + Number(limit));

  return { items, total, page: Number(page), limit: Number(limit) };
}

// ── 2. getUser — single user with manager expanded ────────────────────────────
async function getUser(id) {
  const cacheKey = `ad:user:${id}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const client = getGraphClient();

  // Fetch user detail + manager in parallel
  const [user, manager] = await Promise.allSettled([
    client.api(`/users/${id}?$select=${DETAIL_SELECT}`).get(),
    client.api(`/users/${id}/manager?$select=id,displayName,userPrincipalName,jobTitle,mail,officeLocation`).get(),
  ]);

  const result = user.status === 'fulfilled' ? user.value : null;
  if (!result) throw wrapGraphError(user.reason || new Error(`User ${id} not found`));

  result._manager = manager.status === 'fulfilled' ? manager.value : null;

  await cacheService.set(cacheKey, JSON.stringify(result), TTL_DETAIL);
  return result;
}

// ── 3. getUserDirectReports — for tree on-expand ──────────────────────────────
async function getUserDirectReports(id) {
  const cacheKey = `ad:reports:${id}`;
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try {
      return attachLocalUserIds(JSON.parse(cached));
    } catch (_) {}
  }

  const raw = await fetchAllPages(
    `/users/${id}/directReports?$select=${LIST_SELECT}`
  );
  const reports = raw.filter((u) => u.accountEnabled !== false);

  await cacheService.set(cacheKey, JSON.stringify(reports), TTL_LIST);
  await cacheService.set(`ad:reports-count:${id}`, String(reports.length), TTL_LIST);
  return attachLocalUserIds(reports);
}

/** Lightweight enabled-direct-report count for org-tree Expand badges. */
async function getUserDirectReportsCount(id) {
  const countKey = `ad:reports-count:${id}`;
  const cachedCount = await cacheService.get(countKey);
  if (cachedCount !== null && cachedCount !== undefined) {
    const n = parseInt(cachedCount, 10);
    if (!Number.isNaN(n)) return n;
  }

  const listKey = `ad:reports:${id}`;
  const cachedList = await cacheService.get(listKey);
  if (cachedList) {
    try {
      const reports = JSON.parse(cachedList).filter((u) => u.accountEnabled !== false);
      await cacheService.set(countKey, String(reports.length), TTL_LIST);
      return reports.length;
    } catch (_) {}
  }

  // Minimal select — only need enabled count, not full profile fields
  const raw = await fetchAllPages(
    `/users/${id}/directReports?$select=id,accountEnabled`
  );
  const count = raw.filter((u) => u.accountEnabled !== false).length;
  await cacheService.set(countKey, String(count), TTL_LIST);
  return count;
}

// ── 4. getOrgTreeRoots — users whose manager is not in this org ───────────────
// Uses $expand=manager to fetch each user's manager ID in a single paged request,
// then computes roots locally. Avoids the unreliable NOT(manager/id ne null) filter.
async function getOrgTreeRoots() {
  const cacheKey = 'ad:org-roots:v4';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try {
      return attachLocalUserIds(JSON.parse(cached));
    } catch (_) {}
  }

  // Fetch all users with their manager's ID expanded inline; exclude disabled accounts
  const allUsers = (await fetchAllPages(
    `/users?$select=${LIST_SELECT}&$expand=manager($select=id)&$top=999&$orderby=displayName`
  )).filter((u) => u.accountEnabled !== false);

  const allUserIds = new Set(allUsers.map((u) => u.id));

  // Build set of user IDs that have at least one person reporting to them
  const managerIds = new Set(
    allUsers.filter((u) => u.manager?.id).map((u) => u.manager.id)
  );

  // Root = no internal manager AND has at least one direct report
  // (excludes leaf accounts: test users, meeting rooms, admin accounts with no reports)
  const roots = allUsers
    .filter((u) =>
      (!u.manager?.id || !allUserIds.has(u.manager.id)) &&
      managerIds.has(u.id)
    )
    .map(({ manager, ...rest }) => rest); // strip expanded manager before caching

  await cacheService.set(cacheKey, JSON.stringify(roots), TTL_TREE);
  return attachLocalUserIds(roots);
}

/** Map Entra azure object ids → BrightNow user_id for synced accounts. */
async function attachLocalUserIds(users) {
  if (!Array.isArray(users) || users.length === 0) return users || [];
  const { UserAccount } = require('../../database/models');
  const { Op } = require('sequelize');
  const azureIds = [...new Set(users.map((u) => u.id).filter(Boolean))];
  if (azureIds.length === 0) return users;

  const locals = await UserAccount.findAll({
    where: { azure_object_id: { [Op.in]: azureIds }, deleted_at: null },
    attributes: ['user_id', 'azure_object_id'],
  });
  const byAzure = new Map(locals.map((row) => [row.azure_object_id, row.user_id]));

  return users.map((u) => ({
    ...u,
    local_user_id: byAzure.get(u.id) || null,
  }));
}

// ── 5. getDepartments — distinct department list for filter dropdown ───────────
async function getDepartments() {
  const cacheKey = 'ad:departments';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const users = await getAllUsersFlat();
  const depts = [...new Set(
    users.map(u => u.department).filter(Boolean)
  )].sort();

  await cacheService.set(cacheKey, JSON.stringify(depts), TTL_TREE);
  return depts;
}

async function clearCache() {
  await cacheService.deletePattern('bh:ad:*');
}

// ── Sync helpers (Graph fetch for Entra → BrightNow sync) ─────────────────────
const SYNC_SELECT = [
  'id', 'displayName', 'givenName', 'surname',
  'userPrincipalName', 'mail', 'jobTitle', 'department',
  'companyName', 'officeLocation', 'employeeId', 'employeeType', 'employeeHireDate',
  'businessPhones', 'mobilePhone', 'accountEnabled',
].join(',');

async function fetchGraphUsersForSync({ onlyEnabled = true } = {}) {
  const raw = await fetchAllPages(
    `/users?$select=${SYNC_SELECT}&$expand=manager($select=id,displayName,mail,userPrincipalName)&$top=999&$orderby=displayName`
  );
  return raw
    .filter((u) => (onlyEnabled ? u.accountEnabled !== false : true))
    .map(({ manager, ...u }) => ({
      ...u,
      _managerId: manager?.id || null,
      _managerName: manager?.displayName || null,
      _managerEmail: (manager?.mail || manager?.userPrincipalName || '').trim().toLowerCase() || null,
    }));
}

async function fetchGraphUserForSync(azureObjectId) {
  const client = getGraphClient();
  try {
    const raw = await client
      .api(`/users/${azureObjectId}?$select=${SYNC_SELECT}&$expand=manager($select=id,displayName,mail,userPrincipalName)`)
      .get();
    const { manager, ...u } = raw;
    return {
      ...u,
      _managerId: manager?.id || null,
      _managerName: manager?.displayName || null,
      _managerEmail: (manager?.mail || manager?.userPrincipalName || '').trim().toLowerCase() || null,
    };
  } catch (err) {
    throw wrapGraphError(err);
  }
}

/**
 * Download profile photo binary from Graph. Returns null when the user has no photo.
 * @returns {Promise<{ buffer: Buffer, contentType: string }|null>}
 */
async function fetchUserPhoto(azureObjectId) {
  const client = getGraphClient();
  try {
    const res = await client
      .api(`/users/${azureObjectId}/photo/$value`)
      .responseType('arraybuffer')
      .get();
    const buffer = Buffer.isBuffer(res) ? res : Buffer.from(res);
    if (!buffer.length) return null;
    return { buffer, contentType: 'image/jpeg' };
  } catch (err) {
    const code = err.statusCode || err.code;
    if (code === 404 || code === 'ImageNotFound' || String(err.message || '').includes('404')) {
      return null;
    }
    logger.warn(`Graph photo fetch failed for ${azureObjectId}: ${err.message}`);
    return null;
  }
}

function syncUsersFromEntra(options = {}, actorUserId) {
  // Lazy require avoids circular load with entra-sync.js
  let io = null;
  try {
    io = require('../../config/socket').getIO();
  } catch {
    io = null;
  }

  const onProgress = (payload) => {
    if (!io || !actorUserId) return;
    try {
      io.to(`user:${actorUserId}`).emit('entra:sync-progress', payload);
    } catch (err) {
      logger.warn(`Failed to emit entra:sync-progress: ${err.message}`);
    }
  };

  return require('./entra-sync').syncUsersFromEntra({ ...options, onProgress }, actorUserId);
}

function syncLocalUserFromEntra(options, actorUserId) {
  return require('./entra-sync').syncLocalUserFromEntra(options, actorUserId);
}

module.exports = {
  listUsers,
  getUser,
  getUserDirectReports,
  getUserDirectReportsCount,
  getOrgTreeRoots,
  getDepartments,
  clearCache,
  fetchGraphUsersForSync,
  fetchGraphUserForSync,
  fetchUserPhoto,
  syncUsersFromEntra,
  syncLocalUserFromEntra,
};
