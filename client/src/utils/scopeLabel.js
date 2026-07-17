// Resolves a `{ scope_type, scope_id }` pair to a human-readable breadcrumb
// given the generic org_node tree from `useOrgTree`. `scope_id` is a globally
// unique org_node id, so resolution is by id (scope_type is only a fallback
// label). Returns null if the node can't be found (tree loading / deleted).
import { NODE_TYPE_LABELS } from './constants';

// Returns the ancestor chain [root, …, node] for a node id, or null.
function findChain(node, scopeId, trail = []) {
  if (!node) return null;
  const next = [...trail, node];
  if (node.id === Number(scopeId)) return next;
  for (const child of node.children || []) {
    const found = findChain(child, scopeId, next);
    if (found) return found;
  }
  return null;
}

export function findScopeLabel(tree, scopeType, scopeId) {
  const root = tree?.[0];
  if (!root || !scopeId) return null;
  const chain = findChain(root, scopeId);
  if (!chain) return null;

  const node = chain[chain.length - 1];
  const label = NODE_TYPE_LABELS[node.type] || node.type;
  // node name first, then ancestor names (nearest first), excluding the root group.
  const ancestors = chain.slice(1, -1).map((n) => n.name).reverse();
  const trail = [node.name, ...ancestors].join(' · ');
  return `${label}: ${trail}`;
}

// Ordered array of path segments (top → bottom) for breadcrumb rendering.
export function findScopePath(tree, scopeType, scopeId) {
  const root = tree?.[0];
  if (!root || !scopeId) return null;
  const chain = findChain(root, scopeId);
  if (!chain) return null;
  return chain.map((n) => ({ type: NODE_TYPE_LABELS[n.type] || n.type, name: n.name }));
}
