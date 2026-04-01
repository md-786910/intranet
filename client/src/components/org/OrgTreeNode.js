import React, { useState } from 'react';
import { NODE_TYPE_LABELS } from '../../utils/constants';

const CHILD_TYPE_LABELS = {
  ORGANISATION: 'Add Office Location',
  OFFICE_LOCATION: 'Add Vertical',
  VERTICAL: 'Add Department',
};

const TYPE_COLORS = {
  ORGANISATION: 'text-blue-700 bg-blue-50',
  OFFICE_LOCATION: 'text-emerald-700 bg-emerald-50',
  VERTICAL: 'text-amber-700 bg-amber-50',
  DEPARTMENT: 'text-gray-600 bg-gray-100',
};

const TYPE_ICONS = {
  ORGANISATION: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z',
  OFFICE_LOCATION: 'M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z',
  VERTICAL: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  DEPARTMENT: 'M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z',
};

export default function OrgTreeNode({ node, depth = 0, selectedId, onSelect, onAdd, onEdit, expandAll }) {
  const [expanded, setExpanded] = useState(expandAll !== undefined ? expandAll : true);
  const hasChildren = node.children && node.children.length > 0;
  const childCount = node.children?.length || 0;
  const isSelected = selectedId === node.org_unit_id;
  const canAddChild = node.node_type !== 'DEPARTMENT';
  const childLabel = CHILD_TYPE_LABELS[node.node_type];
  const typeColor = TYPE_COLORS[node.node_type] || TYPE_COLORS.DEPARTMENT;
  const iconPath = TYPE_ICONS[node.node_type] || TYPE_ICONS.DEPARTMENT;

  return (
    <div>
      {/* Node row */}
      <div
        className={`group flex items-center gap-2 py-2 px-3 rounded-lg cursor-pointer transition-all ${
          isSelected
            ? 'bg-primary-50 ring-1 ring-primary-200'
            : 'hover:bg-gray-50'
        }`}
        style={{ marginLeft: `${depth * 24}px` }}
        onClick={() => onSelect(node)}
      >
        {/* Expand/collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="p-0.5 text-gray-400 hover:text-gray-700 flex-shrink-0 rounded transition-colors"
          >
            <svg className={`w-4 h-4 transition-transform duration-150 ${expanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Type icon */}
        <span className={`flex-shrink-0 p-1 rounded ${typeColor}`}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </span>

        {/* Name + meta */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-medium text-gray-900 truncate block" title={node.name}>
            {node.name}
          </span>
          {(node.city || childCount > 0) && (
            <span className="text-xs text-gray-400">
              {node.city && `${node.city}`}
              {node.city && childCount > 0 && ' · '}
              {childCount > 0 && `${childCount} ${childCount === 1 ? 'child' : 'children'}`}
            </span>
          )}
        </div>

        {/* Type label */}
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${typeColor}`}>
          {NODE_TYPE_LABELS[node.node_type]}
        </span>

        {/* Hover actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          {canAddChild && onAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAdd(node); }}
              className="p-1 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded transition-colors"
              title={childLabel}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </button>
          )}
          {node.node_type !== 'ORGANISATION' && onEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(node); }}
              className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="Edit"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <OrgTreeNode
              key={child.org_unit_id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              expandAll={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
