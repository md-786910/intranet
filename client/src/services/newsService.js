import api from '../config/api';

export const newsService = {
  getArticles: (params) => api.get('/news', { params }),
  getArticle: (id, params) => api.get(`/news/${id}`, { params }),
  createArticle: (data) => api.post('/news', data),
  updateArticle: (id, data) => api.put(`/news/${id}`, data),
  deleteArticle: (id) => api.delete(`/news/${id}`),
  publishArticle: (id, params) => api.post(`/news/${id}/publish`, params),
  archiveArticle: (id, params) => api.post(`/news/${id}/archive`, params),
  setAudience: (id, data) => api.post(`/news/${id}/audience`, data),
};
