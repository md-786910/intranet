import React, { useMemo } from 'react';
import { useOrgTree } from '../../hooks/useOrgTree';
import { findScopePath } from '../../utils/scopeLabel';
import { NODE_TYPE_LABELS } from '../../utils/constants';

function chainString(tree, scopeType, scopeId) {
  const path = findScopePath(tree, scopeType, scopeId);
  if (!path?.length) return null;
  return path.map((p) => p.name).join(' › ');
}

/**
 * Audience as professional full-path rows (one chain string per target).
 * Replaces the nested tree for clearer “where this publishes” readability.
 */
export default function AudienceTree({ rules = [] }) {
  const { tree, loading } = useOrgTree();

  const rows = useMemo(() => {
    if (!rules.length) return [];
    return rules.map((r, i) => {
      const scopeType = r.target_scope_type || r.scope_type;
      const scopeId = Number(r.target_scope_id ?? r.scope_id);
      const chain = chainString(tree, scopeType, scopeId);
      const path = findScopePath(tree, scopeType, scopeId);
      const leafType = path?.length
        ? (path[path.length - 1].type)
        : (NODE_TYPE_LABELS[scopeType] || scopeType);
      return {
        key: `${scopeType}:${scopeId}-${i}`,
        chain: chain || `${NODE_TYPE_LABELS[scopeType] || scopeType} #${scopeId}`,
        leafType,
        resolved: Boolean(chain),
      };
    });
  }, [rules, tree]);

  if (rules.length === 0) {
    const rootName = tree?.[0]?.name;
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
        <p className="text-sm text-gray-700">
          {rootName
            ? <span className="font-medium text-gray-900">{rootName}</span>
            : <span className="font-medium text-gray-900">Organisation-wide</span>}
          <span className="text-gray-500"> — all units in the hierarchy</span>
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-4 py-3 space-y-2 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-3/4" />
        <div className="h-4 bg-gray-100 rounded w-1/2" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex items-center gap-3 px-4 py-3"
        >
          <p
            className={`min-w-0 flex-1 text-sm leading-snug truncate ${
              row.resolved ? 'text-gray-800' : 'text-gray-500'
            }`}
            title={row.chain}
          >
            {row.chain}
          </p>
          <span className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            {row.leafType}
          </span>
        </div>
      ))}
    </div>
  );
}
