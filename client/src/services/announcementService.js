import api from '../config/api';

export const announcementService = {
  list: (params) => api.get('/announcements', { params }),
  get: (id) => api.get(`/announcements/${id}`),
  create: (data) => api.post('/announcements', data),
  createAndPublish: (data) => api.post('/announcements/publish-now', data),
  createAndSchedule: (data) => api.post('/announcements/schedule-now', data),
  schedule: (id, params) => api.post(`/announcements/${id}/schedule`, params),
  unschedule: (id) => api.post(`/announcements/${id}/unschedule`),
  update: (id, data) => api.put(`/announcements/${id}`, data),
  remove: (id) => api.delete(`/announcements/${id}`),
  publish: (id, params) => api.post(`/announcements/${id}/publish`, params),
  unpublish: (id) => api.post(`/announcements/${id}/unpublish`),
  archive: (id) => api.post(`/announcements/${id}/archive`),
  setAudience: (id, data) => api.post(`/announcements/${id}/audience`, data),
  bulkRestore: (ids) => api.post('/announcements/bulk-restore', { ids }),
  bulkPurge: (ids) => api.post('/announcements/bulk-purge', { ids }),
};
