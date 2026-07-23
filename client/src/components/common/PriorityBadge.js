import React from 'react';

export const PRIORITY_OPTIONS = [
  { value: 'LOW', label: 'Low' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'HIGH', label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const STYLES = {
  LOW: {
    pill: 'bg-gray-100 text-gray-700',
    dot: 'bg-gray-400',
    lane: 'border-l-[3px] border-l-gray-400',
    label: 'Low',
  },
  NORMAL: {
    pill: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    lane: '',
    label: 'Normal',
  },
  HIGH: {
    pill: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
    lane: 'border-l-[3px] border-l-orange-500',
    label: 'High',
  },
  URGENT: {
    pill: 'bg-red-600 text-white',
    dot: 'bg-red-600',
    lane: 'border-l-[3px] border-l-red-600',
    label: 'Urgent',
  },
};

/** Left-edge row stripe class for list tables (empty for NORMAL). */
export function priorityLaneClass(priority, { hideOnNormal = true } = {}) {
  const key = priority || 'NORMAL';
  if (hideOnNormal && key === 'NORMAL') return '';
  return (STYLES[key] || STYLES.NORMAL).lane;
}

export default function PriorityBadge({ priority = 'NORMAL', size = 'md', hideOnNormal = false }) {
  const conf = STYLES[priority] || STYLES.NORMAL;
  if (hideOnNormal && priority === 'NORMAL') return null;

  const padding =
    size === 'lg' ? 'px-4 py-1.5 text-sm font-bold' :
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px] font-semibold' :
    'px-2 py-0.5 text-[11px] font-semibold';

  return (
    <span className={`inline-flex items-center rounded-full uppercase tracking-wide ${padding} ${conf.pill}`}>
      {conf.label}
    </span>
  );
}
