import api from '../config/api';

export const quickLinksService = {
  list: () => api.get('/quick-links'),
};
