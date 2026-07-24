import React, { useEffect, useMemo, useState } from 'react';
import { useOrgTree } from '../../hooks/useOrgTree';
import { NODE_TYPE_LABELS } from '../../utils/constants';

// Recursive checkbox tree over the generic org_node tree. Selecting a node
// emits a scope { scope_type, scope_id, scope_label } where scope_type is the
// node's type and scope_id is its id. Works at any depth (operational +
// administrative branches). Leaving everything unchecked assigns at the root.

function haveSameScopes(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  // Compare by scope_id only — parent forms may label a node as DEPARTMENT while
  // the tree emits the real node_type (e.g. OFFICE_LOCATION), which must not
  // thrash onChange / wipe the selection.
  const normalize = (scopes) => [...scopes].map((s) => String(s.scope_id)).sort();
  const l = normalize(left);
  const r = normalize(right);
  return l.every((v, i) => v === r[i]);
}

function flatten(node, acc = []) {
  if (!node) return acc;
  acc.push(node);
  (node.children || []).forEach((c) => flatten(c, acc));
  return acc;
}

// Map of node id -> array of ancestor names (root-first, INCLUDING the root
// group name) so every node's full parent context is visible — a node placed
// directly under the root still shows the root/company name.
function buildPaths(root) {
  const map = new Map();
  const walk = (node, trail) => {
    map.set(String(node.id), trail);
    const nextTrail = [...trail, node.name];
    (node.children || []).forEach((c) => walk(c, nextTrail));
  };
  if (root) walk(root, []);
  return map;
}

function TreeRows({ node, depth, selectedIds, toggle, disabled, pathById }) {
  const isRoot = depth === 0;
  return (
    <>
      <div
        className="flex items-start gap-2 py-1.5"
        style={{ paddingLeft: `${depth * 18}px` }}
      >
        {isRoot ? (
          <span className="text-xs text-gray-400 w-4" />
        ) : (
          <input
            type="checkbox"
            checked={selectedIds.includes(String(node.id))}
            onChange={() => toggle(node)}
            disabled={disabled}
            className="mt-0.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
        )}
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="text-sm text-gray-800">{node.name}</span>
            <span className="text-[10px] uppercase tracking-wide text-gray-400">
              {NODE_TYPE_LABELS[node.type] || node.type}
            </span>
          </span>
          {/* Parent path so it's clear which company/vertical this node sits under */}
          {!isRoot && (pathById.get(String(node.id)) || []).length > 0 && (
            <span className="block text-[11px] text-gray-400 truncate">
              {(pathById.get(String(node.id)) || []).join(' › ')}
            </span>
          )}
        </span>
      </div>
      {(node.children || []).map((child) => (
        <TreeRows
          key={child.id}
          node={child}
          depth={depth + 1}
          selectedIds={selectedIds}
          toggle={toggle}
          disabled={disabled}
          pathById={pathById}
        />
      ))}
    </>
  );
}

export default function HierarchyScopeSelector({
  value = [],
  onChange,
  disabled = false,
  className = '',
}) {
  const { tree, loading, error, refetch } = useOrgTree();
  const [selectedIds, setSelectedIds] = useState([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  const rootNode = tree[0] || null;
  const allNodes = useMemo(() => (rootNode ? flatten(rootNode) : []), [rootNode]);
  const nodeById = useMemo(() => {
    const m = new Map();
    allNodes.forEach((n) => m.set(String(n.id), n));
    return m;
  }, [allNodes]);
  const pathById = useMemo(() => buildPaths(rootNode), [rootNode]);

  // Full breadcrumb for a node id, e.g. "BTX › Austria › Product › HR".
  const fullPath = (id) => {
    const node = nodeById.get(String(id));
    if (!node) return '';
    return [...(pathById.get(String(id)) || []), node.name].join(' › ');
  };

  const toggle = (node) => {
    const id = String(node.id);
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  };

  const resolvedScopes = useMemo(() => {
    if (!rootNode) return [];
    if (selectedIds.length === 0) {
      return [{ scope_type: rootNode.type, scope_id: rootNode.id, scope_label: rootNode.name }];
    }
    return selectedIds
      .map((id) => nodeById.get(id))
      .filter(Boolean)
      .map((node) => ({
        scope_type: node.type,
        scope_id: node.id,
        scope_label: `${NODE_TYPE_LABELS[node.type] || node.type}: ${fullPath(node.id)}`,
      }));
  }, [rootNode, selectedIds, nodeById]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!onChange || loading || !rootNode) return;
    if (haveSameScopes(value, resolvedScopes)) return;
    onChange(resolvedScopes);
  }, [loading, onChange, rootNode, resolvedScopes, value]);

  // Hydrate selection from an incoming value (skip the implicit root scope).
  useEffect(() => {
    if (hasHydrated || !rootNode || !Array.isArray(value) || value.length === 0) return;
    const ids = value
      .filter((s) => Number(s.scope_id) !== Number(rootNode.id))
      .map((s) => String(s.scope_id))
      .filter((id) => nodeById.has(id));
    setSelectedIds(ids);
    setHasHydrated(true);
  }, [hasHydrated, rootNode, value, nodeById]);

  if (error) {
    return (
      <div className={className}>
        <p className="text-sm text-red-600">
          {error}{' '}
          <button type="button" onClick={refetch} className="underline text-primary-600 hover:text-primary-700">
            Retry
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="rounded-xl border border-gray-200 max-h-72 overflow-y-auto px-3 py-2">
        {loading && <p className="text-sm text-gray-400 py-2">Loading organisation…</p>}
        {!loading && rootNode && (
          <TreeRows node={rootNode} depth={0} selectedIds={selectedIds} toggle={toggle} disabled={disabled} pathById={pathById} />
        )}
        {!loading && !rootNode && <p className="text-sm text-gray-400 py-2">No organisation structure found.</p>}
      </div>
      <p className="text-xs text-gray-500">
        Tick one or more units to scope here. Leave everything unticked to assign at the top (organisation-wide).
      </p>

      {!loading && resolvedScopes.length > 0 && (
        <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Resolved Scopes</span>
            <span className="text-xs font-medium text-gray-500">{resolvedScopes.length} selected</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {resolvedScopes.map((scope) => (
              <span
                key={`${scope.scope_type}-${scope.scope_id}`}
                className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-200"
              >
                {scope.scope_label}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
