import React from 'react';

export default function SectionHeader({ title, right, className = '' }) {
  return (
    <div className={`flex items-center justify-between ${className}`}>
      <h2 className="font-h2 text-h2 text-on-surface">{title}</h2>
      {right ? <div className="text-body-sm">{right}</div> : null}
    </div>
  );
}
