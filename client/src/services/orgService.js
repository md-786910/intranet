import api from '../config/api';

export const orgService = {
  getOrgTree: () => api.get('/org/tree'),
  getOrgUnit: (id) => api.get(`/org/${id}`),
  getOrgUnitChildren: (id) => api.get(`/org/${id}/children`),
  getOrgUnitSubtree: (id) => api.get(`/org/${id}/subtree`),
  createOfficeLocation: (data) => api.post('/org/office-locations', data),
  updateOfficeLocation: (id, data) => api.put(`/org/office-locations/${id}`, data),
  deleteOfficeLocation: (id) => api.delete(`/org/office-locations/${id}`),
  createVertical: (data) => api.post('/org/verticals', data),
  updateVertical: (id, data) => api.put(`/org/verticals/${id}`, data),
  deleteVertical: (id) => api.delete(`/org/verticals/${id}`),
  createDepartment: (data) => api.post('/org/departments', data),
  updateDepartment: (id, data) => api.put(`/org/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/org/departments/${id}`),
};
