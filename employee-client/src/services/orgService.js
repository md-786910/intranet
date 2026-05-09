import api from '../config/api';

export const orgService = {
  getMyVertical: (params) => api.get('/org/my-vertical', { params }),
  getMyHierarchy: () => api.get('/org/my-hierarchy'),
};
