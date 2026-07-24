import api from '../config/api';

/** Entra/AD read endpoints used by the org hierarchy (auth-only on server). */
export const azureAdService = {
  getDirectReports: (id) => api.get(`/azure-ad/users/${id}/direct-reports`),
  getOrgTreeRoots: () => api.get('/azure-ad/org-tree/roots'),
};
