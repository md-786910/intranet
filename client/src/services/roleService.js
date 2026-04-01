import api from '../config/api';

export const roleService = {
  getRoles: (params) => api.get('/roles', { params }),
  getRole: (id, params) => api.get(`/roles/${id}`, { params }),
  getModules: (params) => api.get('/roles/modules', { params }),
  createRole: (data) => api.post('/roles', data),
  updateRole: (id, data) => api.put(`/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/roles/${id}`),
  cloneRole: (id, data) => api.post(`/roles/${id}/clone`, data),
};
