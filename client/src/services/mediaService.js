import api from '../config/api';

export const mediaService = {
  list: (params) => api.get('/media', { params }),
  upload: (file, onProgress, options = {}) => {
    const formData = new FormData();
    formData.append('file', file);
    if (options.context) formData.append('context', options.context);
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  getMedia: (id) => api.get(`/media/${id}`),
  deleteMedia: (id) => api.delete(`/media/${id}`),
  bulkDelete: (ids) => api.post('/media/bulk-delete', { ids }),
  bulkRestore: (ids) => api.post('/media/bulk-restore', { ids }),
  bulkPurge: (ids) => api.post('/media/bulk-purge', { ids }),
};
