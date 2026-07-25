'use strict';

const service = require('./azure-ad.service');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');
const auditService = require('../../services/audit.service');
const permissionService = require('../../services/permission.service');

/**
 * Public org-chart projection for employees (no email/phone/UPN/etc.).
 * Admins with Manage Users still get the full Graph payload for AD tooling.
 */
function toPublicOrgPerson(user) {
  if (!user) return user;
  return {
    id: user.id,
    displayName: user.displayName || null,
    jobTitle: user.jobTitle || null,
    local_user_id: user.local_user_id || null,
  };
}

async function canSeeDirectoryPii(userId) {
  return permissionService.hasPermissionAnywhere(userId, 'ADMIN', 'MANAGE_USERS');
}

async function shapeOrgChartPayload(req, users) {
  const full = await canSeeDirectoryPii(req.user.user_id);
  if (full) return users;
  return (users || []).map(toPublicOrgPerson);
}

// GET /azure-ad/users
const listUsers = catchAsync(async (req, res) => {
  const { search, department, accountEnabled, page, limit } = req.query;
  const result = await service.listUsers({ search, department, accountEnabled, page, limit });
  res.json({ status: 'success', data: result });
});

// GET /azure-ad/users/:id
const getUser = catchAsync(async (req, res) => {
  const user = await service.getUser(req.params.id);
  if (!user) throw ApiError.notFound('Azure AD user not found');
  res.json({ status: 'success', data: user });
});

// GET /azure-ad/users/:id/direct-reports
const getUserDirectReports = catchAsync(async (req, res) => {
  const result = await service.getUserDirectReports(req.params.id);
  const reports = Array.isArray(result) ? result : (result.reports || []);
  res.json({
    status: 'success',
    data: await shapeOrgChartPayload(req, reports),
    meta: {
      count: Array.isArray(result) ? reports.length : (result.count || 0),
      inactiveCount: Array.isArray(result) ? 0 : (result.inactiveCount || 0),
    },
  });
});

// GET /azure-ad/users/:id/direct-reports/count
const getUserDirectReportsCount = catchAsync(async (req, res) => {
  const counts = await service.getUserDirectReportsCount(req.params.id);
  res.json({
    status: 'success',
    data: {
      count: counts.count || 0,
      inactiveCount: counts.inactiveCount || 0,
    },
  });
});

// GET /azure-ad/org-tree/roots
const getOrgTreeRoots = catchAsync(async (req, res) => {
  const result = await service.getOrgTreeRoots();
  let roots = Array.isArray(result) ? result : (result.roots || []);
  const totalUsers = Array.isArray(result) ? null : result.totalUsers;
  const reportingUsers = Array.isArray(result) ? null : result.reportingUsers;
  const orphanUsers = Array.isArray(result) ? null : result.orphanUsers;

  // Employee org chart: reporting hierarchy only (no "Other active users" bucket)
  const full = await canSeeDirectoryPii(req.user.user_id);
  if (!full) {
    roots = roots.filter((r) => !service.isOrphanRootId(r.id) && !r._virtual);
  }

  res.json({
    status: 'success',
    data: await shapeOrgChartPayload(req, roots),
    meta: {
      totalUsers: totalUsers == null ? null : Number(totalUsers) || 0,
      reportingUsers: reportingUsers == null ? null : Number(reportingUsers) || 0,
      orphanUsers: orphanUsers == null ? null : Number(orphanUsers) || 0,
    },
  });
});

// GET /azure-ad/directory-counts — read-only Entra totals (no sync / no writes)
const getDirectoryCounts = catchAsync(async (req, res) => {
  const counts = await service.getEntraDirectoryCounts();
  res.json({ status: 'success', data: counts });
});

// GET /azure-ad/departments
const getDepartments = catchAsync(async (req, res) => {
  const depts = await service.getDepartments();
  res.json({ status: 'success', data: depts });
});

// GET /azure-ad/test-connection  — returns raw Graph error for debugging
const testConnection = catchAsync(async (req, res) => {
  const { ClientSecretCredential } = require('@azure/identity');
  const { Client } = require('@microsoft/microsoft-graph-client');
  const { TokenCredentialAuthenticationProvider } = require('@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials');
  require('isomorphic-fetch');

  const tenantId     = process.env.AZURE_TENANT_ID;
  const clientId     = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;

  try {
    const credential   = new ClientSecretCredential(tenantId, clientId, clientSecret);
    const authProvider = new TokenCredentialAuthenticationProvider(credential, { scopes: ['https://graph.microsoft.com/.default'] });
    const client       = Client.initWithMiddleware({ authProvider });

    // Minimal call — just fetch 1 user
    const result = await client.api('/users?$top=1&$select=id,displayName').get();
    res.json({
      status: 'success',
      message: 'Graph API connection OK',
      sampleUser: result.value?.[0] || null,
      // Do not echo tenantId / clientId — reduces recon if a session is stolen
      configured: Boolean(tenantId && clientId && clientSecret),
    });
  } catch (err) {
    res.status(200).json({
      status: 'graph_error',
      statusCode: err.statusCode || err.code,
      message: err.message,
      body: err.body || null,
      configured: Boolean(tenantId && clientId && clientSecret),
      hint: err.statusCode === 403
        ? 'Missing "User.Read.All" Application permission or admin consent not granted'
        : err.statusCode === 401
        ? 'Invalid AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID'
        : 'Unknown error',
    });
  }
});

// DELETE /azure-ad/cache
const clearCache = catchAsync(async (req, res) => {
  await service.clearCache();
  res.json({ status: 'success', message: 'Active Directory cache cleared' });
});

// POST /azure-ad/sync-users
const syncUsers = catchAsync(async (req, res) => {
  const { dry_run, only_enabled, password } = req.body;
  const result = await service.syncUsersFromEntra({
    dryRun: dry_run,
    onlyEnabled: only_enabled !== false,
    password,
  }, req.user.user_id);

  await auditService.log({
    user_id: req.user.user_id,
    action: dry_run ? 'ENTRA_SYNC_PREVIEW' : 'ENTRA_SYNC',
    resource_type: 'AzureAd',
    details: {
      dry_run: Boolean(dry_run),
      emails_disabled: true,
      total_graph: result.total_graph || 0,
      created: result.created || 0,
      updated: result.updated || 0,
      skipped: result.skipped || 0,
      reporting_linked: result.reporting_linked || 0,
      error_count: Array.isArray(result.errors) ? result.errors.length : 0,
      password_auto_generated: Boolean(result.password_auto_generated),
    },
    result: 'SUCCESS',
  });

  res.json({ status: 'success', data: result });
});

// POST /azure-ad/sync-local-user/:userId — refresh one BrightNow user from Entra
const syncLocalUser = catchAsync(async (req, res) => {
  const result = await service.syncLocalUserFromEntra({
    userId: Number(req.params.userId),
  }, req.user.user_id);
  res.json({ status: 'success', data: result });
});

module.exports = {
  listUsers,
  getUser,
  getUserDirectReports,
  getUserDirectReportsCount,
  getOrgTreeRoots,
  getDirectoryCounts,
  getDepartments,
  testConnection,
  clearCache,
  syncUsers,
  syncLocalUser,
};
