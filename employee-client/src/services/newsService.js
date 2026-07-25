import axios from 'axios';
import api from '../config/api';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1';

// Plain axios instance without auth interceptors — used for the public share read.
const publicApi = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

export const newsService = {
  // skipGlobalError: pages own EmptyState / NotFoundState for reads
  getArticles: (params) => api.get('/news', { params: { ...params, viewer: 1 }, skipGlobalError: true }),
  getArticle: (id) => api.get(`/news/${id}`, { skipGlobalError: true }),

  // Engagement
  likeArticle: (id) => api.post(`/news/${id}/like`),
  unlikeArticle: (id) => api.delete(`/news/${id}/like`),
  listComments: (id, params) => api.get(`/news/${id}/comments`, { params, skipGlobalError: true }),
  addComment: (id, body) => api.post(`/news/${id}/comments`, { body }),
  updateComment: (id, commentId, body) => api.put(`/news/${id}/comments/${commentId}`, { body }),
  deleteComment: (id, commentId) => api.delete(`/news/${id}/comments/${commentId}`),
  shareArticle: (id, channel) => api.post(`/news/${id}/share`, { channel }),
  saveArticle: (id) => api.post(`/news/${id}/save`),
  unsaveArticle: (id) => api.delete(`/news/${id}/save`),

  // Public read (no auth)
  getPublicShare: (token) => publicApi.get(`/public/news/share/${token}`),
};
