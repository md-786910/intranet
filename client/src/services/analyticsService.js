import api from '../config/api';

export const analyticsService = {
  getDashboard: (params) => api.get('/analytics/dashboard', { params }),
  getContentAnalytics: (params) => api.get('/analytics/content', { params }),
  getUserAnalytics: (params) => api.get('/analytics/users', { params }),
  getPushAnalytics: (params) => api.get('/analytics/push', { params }),
};
