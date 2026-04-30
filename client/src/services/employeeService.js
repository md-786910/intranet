import api from '../config/api';

export const employeeService = {
  listEmployees: (params) => api.get('/employees', { params }),
  getEmployee: (id) => api.get(`/employees/${id}`),
  createEmployee: (data) => api.post('/employees', data),
  updateEmployee: (id, data) => api.put(`/employees/${id}`, data),
  deleteEmployee: (id) => api.delete(`/employees/${id}`),
  resendInvite: (id) => api.post(`/employees/${id}/resend-invite`),

  // Public (no auth header needed; the api client tolerates it)
  validateInvitation: (token) => api.get(`/auth/invitations/${token}/validate`),
  acceptInvitation: (token, password) => api.post(`/auth/invitations/${token}/accept`, { password }),
};
