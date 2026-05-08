import React from 'react';

export default function DayDivider({ label = 'Today' }) {
  return (
    <div className="flex justify-center my-4">
      <span className="px-3 py-1 bg-white border border-outline-variant rounded-full text-[11px] font-semibold text-outline tracking-wider uppercase">
        {label}
      </span>
    </div>
  );
}
