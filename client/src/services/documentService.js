import api from '../config/api';

export const documentService = {
  getDocuments: (params) => api.get('/documents', { params }),
  getDocument: (id, params) => api.get(`/documents/${id}`, { params }),
  createDocument: (data) => api.post('/documents', data),
  updateDocument: (id, data) => api.put(`/documents/${id}`, data),
  deleteDocument: (id) => api.delete(`/documents/${id}`),
  publishDocument: (id, params) => api.post(`/documents/${id}/publish`, params),
  unpublishDocument: (id) => api.post(`/documents/${id}/unpublish`),
  bulkRestore: (ids) => api.post('/documents/bulk-restore', { ids }),
  bulkPurge: (ids) => api.post('/documents/bulk-purge', { ids }),
  getVersions: (id, params) => api.get(`/documents/${id}/versions`, { params }),
  uploadVersion: (id, data) => api.post(`/documents/${id}/versions`, data),
  getCategories: (params) => api.get('/documents/categories', { params }),
  createCategory: (data) => api.post('/documents/categories', data),
  updateCategory: (id, data) => api.put(`/documents/categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/documents/categories/${id}`),
};
