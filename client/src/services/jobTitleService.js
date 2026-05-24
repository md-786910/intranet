import api from '../config/api';

export const jobTitleService = {
  list:   ()         => api.get('/job-titles'),
  create: (data)     => api.post('/job-titles', data),
  update: (id, data) => api.put(`/job-titles/${id}`, data),
  remove: (id)       => api.delete(`/job-titles/${id}`),
};
