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

export default function OrgTreeView({ tree = [], selectedId, onSelect, onAdd, onEdit, loading, onRetry }) {
  const [search, setSearch] = useState('');
  const [expandAll, setExpandAll] = useState(undefined); // undefined = default behavior

  const filteredTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const totalNodes = useMemo(() => countNodes(tree), [tree]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 4) * 24}px` }}>
            <div className="h-4 w-4 bg-gray-200 rounded" />
            <div className="h-4 bg-gray-200 rounded flex-1 max-w-[200px]" />
          </div>
        ))}
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="text-center py-12">
        <svg className="mx-auto w-12 h-12 text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
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
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter tree..."
            className="w-full pl-10 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setExpandAll(true)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Expand all
        </button>
        <button
          onClick={() => setExpandAll(false)}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Collapse all
        </button>
        <span className="text-xs text-gray-400 ml-auto">{totalNodes} nodes</span>
      </div>

      {/* Tree */}
      <div className="space-y-0.5">
        {filteredTree.length === 0 ? (
          <div className="text-center py-8 text-sm text-gray-500">
            No results for "{search}"
          </div>
        ) : (
          filteredTree.map((node) => (
            <OrgTreeNode
              key={node.org_unit_id}
              node={node}
              selectedId={selectedId}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              expandAll={expandAll}
            />
          ))
        )}
      </div>
    </div>
  );
}
