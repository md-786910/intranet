import api from '../config/api';

export const appSettingsService = {
  get: () => api.get('/app-settings'),
};
