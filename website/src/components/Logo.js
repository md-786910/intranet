import React from 'react';

export default function Logo({ size = 'md', showWordmark = true, className = '' }) {
  const markSize = size === 'lg' ? 'w-10 h-10' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const wordSize = size === 'lg' ? 'text-3xl' : size === 'sm' ? 'text-lg' : 'text-2xl';

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <div
        className={`${markSize} rounded-xl bg-gray-900 flex items-center justify-center text-white shadow-sm`}
      >
        <svg viewBox="0 0 24 24" className="w-1/2 h-1/2" fill="none">
          <circle cx="12" cy="12" r="2.2" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="12" y1="2.5" x2="12" y2="6" />
            <line x1="12" y1="18" x2="12" y2="21.5" />
            <line x1="2.5" y1="12" x2="6" y2="12" />
            <line x1="18" y1="12" x2="21.5" y2="12" />
            <line x1="5.2" y1="5.2" x2="7.7" y2="7.7" />
            <line x1="16.3" y1="16.3" x2="18.8" y2="18.8" />
            <line x1="5.2" y1="18.8" x2="7.7" y2="16.3" />
            <line x1="16.3" y1="7.7" x2="18.8" y2="5.2" />
          </g>
        </svg>
      </div>
      {showWordmark && (
        <span className={`font-bold tracking-tight text-gray-900 ${wordSize}`}>
          Bright<span className="font-black">NOW</span>
        </span>
      )}
    </div>
  );
}
