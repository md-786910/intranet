import api from '../config/api';

export const azureAdService = {
  /** Paginated + filtered user list */
  getUsers: (params) => api.get('/azure-ad/users', { params }),

  /** Single user with manager included */
  getUser: (id) => api.get(`/azure-ad/users/${id}`),

  /** Direct reports — used by org tree on-expand */
  getDirectReports: (id) => api.get(`/azure-ad/users/${id}/direct-reports`),

  /** Enabled direct-report count — Expand badge without loading full list */
  getDirectReportsCount: (id) => api.get(`/azure-ad/users/${id}/direct-reports/count`),

  /** Root nodes for the org hierarchy tree */
  getOrgTreeRoots: () => api.get('/azure-ad/org-tree/roots'),

  /** Read-only Entra directory totals (total / active / inactive) — never syncs */
  getDirectoryCounts: () => api.get('/azure-ad/directory-counts'),

  /** Distinct department names for the filter dropdown */
  getDepartments: () => api.get('/azure-ad/departments'),

  /** Sync Entra users into BrightNow (password create / email update, no email) */
  syncUsers: (body) => api.post('/azure-ad/sync-users', body),

  /** Sync one BrightNow user from Entra by local user_id */
  syncLocalUser: (userId) => api.post(`/azure-ad/sync-local-user/${userId}`),

  /** Clear all Azure AD Redis cache keys */
  clearCache: () => api.delete('/azure-ad/cache'),
};
