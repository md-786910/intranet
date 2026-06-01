'use strict';

const service = require('./azure-ad.service');
const ApiError = require('../../utils/ApiError');
const catchAsync = require('../../utils/catchAsync');

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
  const reports = await service.getUserDirectReports(req.params.id);
  res.json({ status: 'success', data: reports });
});

// GET /azure-ad/org-tree/roots
const getOrgTreeRoots = catchAsync(async (req, res) => {
  const roots = await service.getOrgTreeRoots();
  res.json({ status: 'success', data: roots });
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
      tenantId, clientId,
    });
  } catch (err) {
    res.status(200).json({
      status: 'graph_error',
      statusCode: err.statusCode || err.code,
      message: err.message,
      body: err.body || null,
      tenantId, clientId,
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

module.exports = { listUsers, getUser, getUserDirectReports, getOrgTreeRoots, getDepartments, testConnection, clearCache };
