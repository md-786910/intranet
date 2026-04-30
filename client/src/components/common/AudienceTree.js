import React, { useMemo } from 'react';
import { useOrgTree } from '../../hooks/useOrgTree';

const TYPE_LABELS = {
  ORGANISATION: 'Organisation',
  OFFICE_LOCATION: 'Office',
  VERTICAL: 'Vertical',
  DEPARTMENT: 'Department',
};

const TYPE_PILL_CLASSES = {
  ORGANISATION: 'bg-purple-50 text-purple-700',
  OFFICE_LOCATION: 'bg-blue-50 text-blue-700',
  VERTICAL: 'bg-emerald-50 text-emerald-700',
  DEPARTMENT: 'bg-amber-50 text-amber-700',
};

const TYPE_ICONS = {
  ORGANISATION: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  OFFICE_LOCATION: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.75a3 3 0 013-3h.75',
  VERTICAL: 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
  DEPARTMENT: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
};

function makeKey(type, id) {
  return `${type}:${id}`;
}

// Walk the hydrated org tree and return a Set of every scope key (TYPE:ID).
function indexTree(node, byKey, parentKey = null) {
  if (!node) return;
  const key = makeKey(node.type, node.id);
  byKey.set(key, { node, parentKey });
  (node.children || []).forEach((child) => indexTree(child, byKey, key));
}

// Build the minimum sub-tree that includes every selected scope plus the
// ancestor chain leading to each. Returns roots[].
function buildPrunedTree(roots, selectedKeys) {
  if (!selectedKeys.size) return [];
  const include = new Set();

  // First walk: mark every node that has a selected descendant (or is selected).
  function mark(node) {
    if (!node) return false;
    const key = makeKey(node.type, node.id);
    let keep = selectedKeys.has(key);
    (node.children || []).forEach((child) => {
      if (mark(child)) keep = true;
    });
    if (keep) include.add(key);
    return keep;
  }
  roots.forEach(mark);

  // Second walk: emit only nodes whose keys are in `include`, with children filtered.
  function project(node) {
    const key = makeKey(node.type, node.id);
    if (!include.has(key)) return null;
    const children = (node.children || [])
      .map(project)
      .filter(Boolean);
    return {
      ...node,
      key,
      isSelected: selectedKeys.has(key),
      children,
    };
  }

  return roots.map(project).filter(Boolean);
}

function TreeRow({ node, depth }) {
  const path = TYPE_ICONS[node.type] || TYPE_ICONS.DEPARTMENT;
  const pill = TYPE_PILL_CLASSES[node.type] || 'bg-gray-100 text-gray-700';
  return (
    <li className="relative">
      <div
        className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${
          node.isSelected ? 'bg-primary-50/60' : 'bg-transparent'
        }`}
        style={{ paddingLeft: `${0.75 + depth * 1.25}rem` }}
      >
        <svg className={`w-4 h-4 flex-shrink-0 ${node.isSelected ? 'text-primary-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={path} />
        </svg>
        <span className={`font-medium ${node.isSelected ? 'text-primary-800' : 'text-gray-700'}`}>
          {node.name}
        </span>
        <span className={`ml-auto inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${pill}`}>
          {TYPE_LABELS[node.type] || node.type}
        </span>
        {node.isSelected && (
          <svg className="w-4 h-4 text-primary-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        )}
      </div>
      {node.children?.length > 0 && (
        <ul className="mt-0.5 space-y-0.5 border-l border-gray-200 ml-4">
          {node.children.map((child) => (
            <TreeRow key={child.key} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function AudienceTree({ rules = [] }) {
  const { tree, loading } = useOrgTree();

  const selectedKeys = useMemo(
    () => new Set(rules.map((r) => makeKey(r.target_scope_type, Number(r.target_scope_id)))),
    [rules],
  );

  const pruned = useMemo(() => buildPrunedTree(tree, selectedKeys), [tree, selectedKeys]);

  if (rules.length === 0) {
    return <p className="text-sm text-gray-500">No audience set — this content is private.</p>;
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-6 bg-gray-100 rounded" />
        <div className="h-6 bg-gray-100 rounded ml-4" />
        <div className="h-6 bg-gray-100 rounded ml-8" />
      </div>
    );
  }

  // Detect rules whose scope IDs we couldn't resolve in the org tree (e.g. an
  // office that was deleted) so they're still surfaced — just without context.
  const byKey = new Map();
  tree.forEach((root) => indexTree(root, byKey));
  const orphanRules = rules.filter((r) => !byKey.has(makeKey(r.target_scope_type, Number(r.target_scope_id))));

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-2">
      <ul className="space-y-0.5">
        {pruned.map((root) => (
          <TreeRow key={root.key} node={root} depth={0} />
        ))}
      </ul>
      {orphanRules.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 mb-2">Other audience rules</p>
          <div className="flex flex-wrap gap-2">
            {orphanRules.map((r, i) => (
              <span key={`${r.target_scope_type}:${r.target_scope_id}-${i}`} className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 text-gray-700 text-xs">
                {TYPE_LABELS[r.target_scope_type] || r.target_scope_type}: {r.target_scope_id}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
