import api from '../config/api';

export const documentsService = {
  // for_user=true → backend filters categories to those the caller can see
  // and attaches a live doc_count per category.
  // skipGlobalError on reads: pages own EmptyState / NotFoundState
  listCategories: () => api.get('/documents/categories', { params: { for_user: true }, skipGlobalError: true }),
  getCategory: (id) => api.get(`/documents/categories/${id}/info`, { skipGlobalError: true }),
  listDocuments: (params) => api.get('/documents', { params: { ...params, viewer: 1 }, skipGlobalError: true }),
  getDocument: (id) => api.get(`/documents/${id}`, { skipGlobalError: true }),
  recordView: (id) => api.post(`/documents/${id}/view`, null, { skipGlobalError: true }),
  recentlyViewed: (params) => api.get('/documents/recently-viewed', { params, skipGlobalError: true }),
  featured: () => api.get('/documents/featured', { skipGlobalError: true }),
  storageSummary: () => api.get('/documents/storage-summary', { skipGlobalError: true }),
};
