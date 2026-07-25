import React, { useMemo } from 'react';
import { useOrgTree } from '../../hooks/useOrgTree';
import { NODE_TYPE_LABELS } from '../../utils/constants';
import Select from './Select';

function flattenOptions(node, depth = 0, trail = [], acc = []) {
  if (!node) return acc;
  const typeLabel = NODE_TYPE_LABELS[node.type] || node.type || 'Unit';
  const parentPath = trail.join(' › ');
  const indent = depth > 0 ? `${'\u00A0'.repeat(Math.min(depth, 6) * 2)}` : '';
  acc.push({
    value: String(node.id),
    label: parentPath
      ? `${indent}${node.name} (${typeLabel}) — ${parentPath}`
      : `${indent}${node.name} (${typeLabel})`,
  });
  const nextTrail = [...trail, node.name];
  (node.children || []).forEach((child) => flattenOptions(child, depth + 1, nextTrail, acc));
  return acc;
}

/**
 * Single-select org unit filter for list pages.
 * Value is org_node id (string) or "" for no filter.
 */
export default function OrgNodeFilterSelect({
  name = 'node_id',
  value = '',
  onChange,
  disabled = false,
  className = '',
  placeholder = 'All organisation units',
}) {
  const { tree, loading } = useOrgTree();
  const root = tree[0] || null;

  const options = useMemo(() => (root ? flattenOptions(root) : []), [root]);

  return (
    <div className={`relative ${className}`}>
      <Select
        name={name}
        value={value}
        onChange={onChange}
        placeholder={loading ? 'Loading org tree…' : placeholder}
        options={options}
        disabled={disabled || loading}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange({ target: { name, value: '' } })}
          className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          title="Clear"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
