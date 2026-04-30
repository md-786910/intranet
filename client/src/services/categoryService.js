import api from '../config/api';

export const categoryService = {
  list: (params) => api.get('/categories', { params }),
  create: (data) => api.post('/categories', data),
  update: (id, data) => api.put(`/categories/${id}`, data),
  remove: (id) => api.delete(`/categories/${id}`),
  bulkRestore: (ids) => api.post('/categories/bulk-restore', { ids }),
};
