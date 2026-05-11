import api from '../config/api';

export const quickLinkService = {
  list: () => api.get('/quick-links'),
  create: (data) => api.post('/quick-links', data),
  update: (id, data) => api.put(`/quick-links/${id}`, data),
  remove: (id) => api.delete(`/quick-links/${id}`),
};
