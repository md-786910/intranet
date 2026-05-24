import api from '../config/api';

export const documentsService = {
  // for_user=true → backend filters categories to those the caller can see
  // and attaches a live doc_count per category.
  listCategories: () => api.get('/documents/categories', { params: { for_user: true } }),
  getCategory: (id) => api.get(`/documents/categories/${id}/info`),
  listDocuments: (params) => api.get('/documents', { params: { ...params, viewer: 1 } }),
  getDocument: (id) => api.get(`/documents/${id}`),
  recordView: (id) => api.post(`/documents/${id}/view`),
  recentlyViewed: (params) => api.get('/documents/recently-viewed', { params }),
  featured: () => api.get('/documents/featured'),
  storageSummary: () => api.get('/documents/storage-summary'),
};
