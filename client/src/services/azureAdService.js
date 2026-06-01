import api from '../config/api';

export const azureAdService = {
  /** Paginated + filtered user list */
  getUsers: (params) => api.get('/azure-ad/users', { params }),

  /** Single user with manager included */
  getUser: (id) => api.get(`/azure-ad/users/${id}`),

  /** Direct reports — used by org tree on-expand */
  getDirectReports: (id) => api.get(`/azure-ad/users/${id}/direct-reports`),

  /** Root nodes for the org hierarchy tree */
  getOrgTreeRoots: () => api.get('/azure-ad/org-tree/roots'),

  /** Distinct department names for the filter dropdown */
  getDepartments: () => api.get('/azure-ad/departments'),

  /** Clear all Azure AD Redis cache keys */
  clearCache: () => api.delete('/azure-ad/cache'),
};
