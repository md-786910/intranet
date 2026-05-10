import React from 'react';

export default function DayDivider({ label = 'Today' }) {
  return (
    <div className="flex items-center gap-4 my-6">
      <div className="flex-grow h-px bg-outline-variant/50" />
      <span className="px-4 py-1.5 bg-white border border-outline-variant rounded-full text-[10px] font-bold text-outline tracking-widest uppercase shadow-sm whitespace-nowrap">
        {label}
      </span>
      <div className="flex-grow h-px bg-outline-variant/50" />
    </div>
  );
}
