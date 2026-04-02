import api from '../config/api';

export const orgService = {
  getOrgTree: () => api.get('/org/tree'),
  createOfficeLocation: (data) => api.post('/org/office-locations', data),
  updateOfficeLocation: (id, data) => api.put(`/org/office-locations/${id}`, data),
  deleteOfficeLocation: (id, data) => api.delete(`/org/office-locations/${id}`, { data }),
  createVertical: (data) => api.post('/org/verticals', data),
  updateVertical: (id, data) => api.put(`/org/verticals/${id}`, data),
  deleteVertical: (id, data) => api.delete(`/org/verticals/${id}`, { data }),
  createDepartment: (data) => api.post('/org/departments', data),
  updateDepartment: (id, data) => api.put(`/org/departments/${id}`, data),
  deleteDepartment: (id, data) => api.delete(`/org/departments/${id}`, { data }),
};

/**
 * Transform the nested API response into a flat tree structure
 * compatible with OrgTreeNode/OrgTreeView components.
 * Each node gets { id, type, name, children, ...fields }
 */
export function transformOrgTree(org) {
  if (!org) return [];

  const orgNode = {
    id: org.id,
    type: 'ORGANISATION',
    name: org.name,
    code: org.code,
    city: org.city,
    country: org.country,
    status: org.status,
    children: (org.officeLocations || []).map((office) => ({
      id: office.id,
      type: 'OFFICE_LOCATION',
      name: office.name,
      code: office.code,
      city: office.city,
      country: office.country,
      status: office.status,
      organisation_id: office.organisation_id,
      children: (office.verticals || []).map((vertical) => ({
        id: vertical.id,
        type: 'VERTICAL',
        name: vertical.name,
        code: vertical.code,
        status: vertical.status,
        office_location_id: vertical.office_location_id,
        children: (vertical.departments || []).map((dept) => ({
          id: dept.id,
          type: 'DEPARTMENT',
          name: dept.name,
          code: dept.code,
          status: dept.status,
          vertical_id: dept.vertical_id,
          children: [],
        })),
      })),
    })),
  };

  return [orgNode];
}
