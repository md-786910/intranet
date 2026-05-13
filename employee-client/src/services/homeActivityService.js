import api from '../config/api';

export const homeActivityService = {
  list: () => api.get('/home/recent-activity'),
};
