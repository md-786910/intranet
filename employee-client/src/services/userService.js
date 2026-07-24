import api from '../config/api';

export const userService = {
  getDirectoryProfile: (userId) => api.get(`/users/${userId}/directory-profile`),
};
