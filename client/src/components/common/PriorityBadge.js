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
    label: 'Low priority',
  },
  NORMAL: {
    pill: 'bg-blue-50 text-blue-700',
    dot: 'bg-blue-500',
    label: 'Normal priority',
  },
  HIGH: {
    pill: 'bg-orange-500 text-white',
    dot: 'bg-orange-500',
    label: 'High priority',
  },
  URGENT: {
    pill: 'bg-red-600 text-white',
    dot: 'bg-red-600',
    label: 'Urgent',
  },
};

export default function PriorityBadge({ priority = 'NORMAL', size = 'md', hideOnNormal = false }) {
  const conf = STYLES[priority] || STYLES.NORMAL;
  if (hideOnNormal && priority === 'NORMAL') return null;

  if (size === 'sm') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs">
        <span className={`inline-block w-2 h-2 rounded-full ${conf.dot}`} aria-hidden />
        <span className="text-gray-600">{conf.label}</span>
      </span>
    );
  }

  const padding = size === 'lg' ? 'px-4 py-1.5 text-sm' : 'px-3 py-1 text-xs';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-bold uppercase tracking-wide ${padding} ${conf.pill}`}>
      {conf.label}
    </span>
  );
}
