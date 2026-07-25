import api from '../config/api';

export const announcementService = {
  getMarquee: () => api.get('/announcements/marquee', { skipGlobalError: true }),
  getAnnouncements: (params) => api.get('/announcements', { params: { ...params, viewer: 1 }, skipGlobalError: true }),
  getAnnouncement: (id) => api.get(`/announcements/${id}`, { skipGlobalError: true }),
};
