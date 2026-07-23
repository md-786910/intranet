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
 * Compact “publishes to” as a full hierarchy chain string.
 * Empty audience_summary = organisation-wide (Group root).
 */
export default function AudienceSummary({ audience_summary: summary, className = '' }) {
  const { tree } = useOrgTree();

  const items = useMemo(() => {
    if (!Array.isArray(summary) || summary.length === 0) {
      const rootName = tree?.[0]?.name;
      return [{
        key: 'org-wide',
        chain: rootName || 'Organisation-wide',
        muted: true,
      }];
    }

    return summary.map((s, i) => {
      const chain = chainString(tree, s.scope_type, s.scope_id)
        || `${NODE_TYPE_LABELS[s.scope_type] || s.scope_type} #${s.scope_id}`;
      return {
        key: `${s.scope_type}-${s.scope_id}-${i}`,
        chain,
        muted: false,
      };
    });
  }, [summary, tree]);

  const first = items[0];
  const extra = items.length - 1;
  const moreTitle = extra > 0
    ? items.slice(1).map((i) => i.chain).join('\n')
    : undefined;

  return (
    <div className={`min-w-0 ${className}`}>
      <p
        className={`text-xs leading-snug truncate ${
          first.muted ? 'text-gray-500' : 'text-gray-700'
        }`}
        title={first.chain}
      >
        {first.chain}
      </p>
      {extra > 0 && (
        <p className="text-[10px] text-gray-400 mt-0.5" title={moreTitle}>
          +{extra} more
        </p>
      )}
    </div>
  );
}
