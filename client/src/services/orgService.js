import api from '../config/api';

export const orgService = {
  getOrgTree: () => api.get('/org/tree'),

  // Generic node API (operational + administrative, flexible depth)
  createNode: (data) => api.post('/org/nodes', data),
  updateNode: (id, data) => api.put(`/org/nodes/${id}`, data),
  deleteNode: (id) => api.delete(`/org/nodes/${id}`),
  addNodeMember: (id, data) => api.post(`/org/nodes/${id}/members`, data),
  removeNodeMember: (id, userId) => api.delete(`/org/nodes/${id}/members/${userId}`),
  getNodeMembers: (id) => api.get(`/org/nodes/${id}/members`),
};

/**
 * Transform the generic org_node tree (a single root node with nested
 * `children`) into the shape the tree components expect:
 *   { id, type, kind, name, code, city, country, status, memberCount, children }
 * `type` mirrors the backend `node_type`.
 */
export function transformOrgTree(root) {
  if (!root) return [];

  const mapNode = (node) => ({
    id: node.id,
    type: node.node_type,
    kind: node.kind,
    name: node.name,
    code: node.code,
    city: node.city,
    country: node.country,
    address: node.address,
    timezone: node.timezone,
    status: node.status,
    parent_id: node.parent_id,
    memberCount: node.memberCount || 0,
    created_at: node.created_at,
    children: (node.children || []).map(mapNode),
  });

  return [mapNode(root)];
}
