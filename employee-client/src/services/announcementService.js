import api from '../config/api';

export const announcementService = {
  getMarquee: () => api.get('/announcements/marquee'),
  getAnnouncements: (params) => api.get('/announcements', { params: { ...params, viewer: 1 } }),
  getAnnouncement: (id) => api.get(`/announcements/${id}`),
};
