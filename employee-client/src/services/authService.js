import api from '../config/api';

export const authService = {
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),

  validatePasswordReset: (token) =>
    api.get(`/auth/password-resets/${token}/validate`),

  resetPassword: (token, password) =>
    api.post(`/auth/password-resets/${token}/reset`, { password }),

  validateInvitation: (token) =>
    api.get(`/auth/invitations/${token}/validate`),

  acceptInvitation: (token, password) =>
    api.post(`/auth/invitations/${token}/accept`, { password }),

  updateProfile: (data) => api.put('/auth/profile', data),
};
