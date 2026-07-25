import api from '../config/api';

/**
 * Entra org-chart endpoints (any authenticated user).
 * Server returns name + job title only unless the caller has Manage Users.
 */
export const azureAdService = {
  getDirectReports: (id) => api.get(`/azure-ad/users/${id}/direct-reports`),
  getOrgTreeRoots: () => api.get('/azure-ad/org-tree/roots'),
};
