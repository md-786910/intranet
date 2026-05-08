import api from '../config/api';

export const newsService = {
  getArticles: (params) => api.get('/news', { params }),
  getArticle: (id) => api.get(`/news/${id}`),
};
