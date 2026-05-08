import React from 'react';
import MaterialIcon from './MaterialIcon';

export default function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 bg-white border border-outline-variant rounded-2xl ${className}`}
    >
      <div className="w-14 h-14 rounded-full bg-surface-container-low flex items-center justify-center mb-4">
        <MaterialIcon name={icon} className="text-on-surface-variant text-3xl" />
      </div>
      {title && (
        <p className="font-h3 text-h3 text-on-surface mb-1">{title}</p>
      )}
      {description && (
        <p className="text-body-sm text-on-surface-variant max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
