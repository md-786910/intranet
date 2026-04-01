import api from '../config/api';

export const mediaService = {
  upload: (file, onProgress) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress,
    });
  },
  getMedia: (id) => api.get(`/media/${id}`),
  deleteMedia: (id) => api.delete(`/media/${id}`),
};
