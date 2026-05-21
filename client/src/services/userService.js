import api from '../config/api';

export const userService = {
  getUsers: (params) => api.get('/users', { params }),
  getUser: (id, params) => api.get(`/users/${id}`, { params }),
  createUser: (data) => api.post('/users', data),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  deleteUser: (id) => api.delete(`/users/${id}`),
  reactivateUser: (id) => api.post(`/users/${id}/reactivate`),
  permanentDeleteUser: (id) => api.delete(`/users/${id}/permanent`),
  assignRole: (userId, data) => api.post(`/users/${userId}/roles`, data),
  removeRole: (userId, assignmentId) => api.delete(`/users/${userId}/roles/${assignmentId}`),
  addDepartment: (userId, data) => api.post(`/users/${userId}/departments`, data),
  removeDepartment: (userId, deptId) => api.delete(`/users/${userId}/departments/${deptId}`),
  assignPermission: (userId, data) => api.post(`/users/${userId}/permissions`, data),
  removePermission: (userId, permId) => api.delete(`/users/${userId}/permissions/${permId}`),
  importUsers: (data) => api.post('/users/import', data),
};
