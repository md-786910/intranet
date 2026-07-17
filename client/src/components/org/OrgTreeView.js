import React, { useState, useMemo } from 'react';
import OrgTreeNode from './OrgTreeNode';
import Button from '../common/Button';

function filterTree(nodes, query) {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce((acc, node) => {
    const matchesName = node.name.toLowerCase().includes(q);
    const filteredChildren = node.children ? filterTree(node.children, query) : [];
    if (matchesName || filteredChildren.length > 0) {
      acc.push({ ...node, children: matchesName ? node.children : filteredChildren });
    }
    return acc;
  }, []);
}

function countNodes(nodes) {
  return nodes.reduce((sum, n) => sum + 1 + (n.children ? countNodes(n.children) : 0), 0);
}

function countByType(nodes) {
  const counts = {};
  function walk(list) {
    list.forEach((n) => {
      counts[n.type] = (counts[n.type] || 0) + 1;
      if (n.children) walk(n.children);
    });
  }
  walk(nodes);
  return counts;
}

const TYPE_STATS = [
  { type: 'COMPANY', label: 'Companies', color: 'bg-blue-50 text-blue-700' },
  { type: 'OFFICE_LOCATION', label: 'Offices', color: 'bg-emerald-50 text-emerald-700' },
  { type: 'VERTICAL', label: 'Verticals', color: 'bg-violet-50 text-violet-700' },
  { type: 'DEPARTMENT', label: 'Departments', color: 'bg-gray-100 text-gray-600' },
  { type: 'ADMIN_UNIT', label: 'Admin Units', color: 'bg-amber-50 text-amber-700' },
];

export default function OrgTreeView({
  tree = [],
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  loading,
  onRetry,
  canAddNode,
  canEditNode,
}) {
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(undefined);

  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const totalNodes = useMemo(() => countNodes(tree), [tree]);
  const typeCounts = useMemo(() => countByType(tree), [tree]);

  if (loading) {
    return (
      <div className="space-y-3 p-4">
        {[0, 0, 1, 1, 2, 2, 2, 1].map((indent, i) => (
          <div key={i} className="flex items-center gap-3" style={{ paddingLeft: `${indent * 24}px` }}>
            <div className="h-5 w-5 bg-gray-100 rounded-md animate-pulse" />
            <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${140 - indent * 20}px` }} />
          </div>
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
        <svg className="mx-auto w-14 h-14 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
        </svg>
        <p className="text-sm font-medium text-gray-700">No organisation structure found</p>
        <p className="text-xs text-gray-500 mt-1">Create your first office location to get started.</p>
        {onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} className="mt-4">Retry</Button>
        )}
      </div>
    );
  }

  return (
    <div>
      {/* Stats bar */}
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-gray-100">
        {TYPE_STATS.map(({ type, label, color }) => {
          const count = typeCounts[type] || 0;
          return (
            <div key={type} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${color}`}>
              <span className="text-sm font-semibold tabular-nums">{count}</span>
              <span>{label}</span>
            </div>
          );
        })}
        <span className="text-xs text-gray-400 ml-auto tabular-nums">{totalNodes} total nodes</span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tree..."
            className="w-full pl-9 pr-8 py-2 bg-gray-50 border border-transparent rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:bg-white focus:border-gray-300 focus:ring-1 focus:ring-primary-500 transition-colors"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Segmented expand/collapse control */}
        <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandAll(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-200 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={() => setExpandAll(false)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Collapse all
          </button>
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {filteredTree.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No results for &ldquo;{search}&rdquo;
          </div>
        ) : (
          filteredTree.map((node, idx) => (
            <OrgTreeNode
              key={node.id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              expandAll={expandAll}
              isLast={idx === filteredTree.length - 1}
              canAddNode={canAddNode}
              canEditNode={canEditNode}
            />
          ))
        )}
      </div>
    </div>
  );
}
