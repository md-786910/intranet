'use strict';

require('isomorphic-fetch');
const { Client } = require('@microsoft/microsoft-graph-client');
const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
const { ClientSecretCredential } = require('@azure/identity');
const cacheService = require('../../services/cache.service');
const logger = require('../../config/logger');

// ── TTLs ──────────────────────────────────────────────────────────────────────
const TTL_LIST   = 300;   // 5 min  – user list / search results
const TTL_DETAIL = 300;   // 5 min  – individual user + manager
const TTL_TREE   = 600;   // 10 min – org tree flat list

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

// ── Fetch & cache the full flat user list (used for list view + org tree) ─────
async function getAllUsersFlat() {
  const cacheKey = 'ad:all-users';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  const users = await fetchAllPages(
    `/users?$select=${LIST_SELECT}&$top=999&$orderby=displayName`
  );

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
    try { return JSON.parse(cached); } catch (_) {}
  }

  const reports = await fetchAllPages(
    `/users/${id}/directReports?$select=${LIST_SELECT}`
  );

  await cacheService.set(cacheKey, JSON.stringify(reports), TTL_LIST);
  return reports;
}

// ── 4. getOrgTreeRoots — users with no manager (top of hierarchy) ─────────────
async function getOrgTreeRoots() {
  const cacheKey = 'ad:org-roots';
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch (_) {}
  }

  let roots;
  try {
    // ConsistencyLevel: eventual + $count required for NOT() filter
    const client = getGraphClient();
    const response = await client
      .api(`/users?$filter=NOT(manager/id ne null)&$select=${LIST_SELECT}&$count=true&$top=999`)
      .header('ConsistencyLevel', 'eventual')
      .get();
    roots = response.value || [];
  } catch (err) {
    // If it's a permission / auth error — surface it immediately, don't silently fallback
    if (err.statusCode === 401 || err.statusCode === 403 || err.statusCode === 502) throw wrapGraphError(err);
    logger.warn('Graph NOT(manager) filter failed, falling back to full user list:', err.message);
    // Fallback: return all users (frontend expands from any node)
    roots = await getAllUsersFlat();
  }

  await cacheService.set(cacheKey, JSON.stringify(roots), TTL_TREE);
  return roots;
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

module.exports = {
  listUsers,
  getUser,
  getUserDirectReports,
  getOrgTreeRoots,
  getDepartments,
};
