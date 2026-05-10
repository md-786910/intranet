import api from '../config/api';

export const roleCategoryService = {
  list: () => api.get('/role-categories'),
  create: (data) => api.post('/role-categories', data),
  update: (id, data) => api.put(`/role-categories/${id}`, data),
  remove: (id) => api.delete(`/role-categories/${id}`),
  reorder: (orderedIds) => api.put('/role-categories/reorder', { ordered_ids: orderedIds }),
};
