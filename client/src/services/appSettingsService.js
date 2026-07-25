import api from '../config/api';

export const appSettingsService = {
  get: () => api.get('/app-settings'),
  update: (data) => api.put('/app-settings', data),
};
