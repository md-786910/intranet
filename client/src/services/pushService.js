import api from '../config/api';

export const pushService = {
  getCampaigns: (params) => api.get('/push', { params }),
  getCampaign: (id, params) => api.get(`/push/${id}`, { params }),
  createCampaign: (data) => api.post('/push', data),
  sendCampaign: (id, params) => api.post(`/push/${id}/send`, params),
  cancelCampaign: (id, params) => api.post(`/push/${id}/cancel`, params),
};
