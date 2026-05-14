import api from '../config/api';

export const announcementService = {
  getMarquee: () => api.get('/announcements/marquee'),
  getAnnouncements: (params) => api.get('/announcements', { params }),
  getAnnouncement: (id) => api.get(`/announcements/${id}`),
};
