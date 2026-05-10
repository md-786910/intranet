import React from 'react';

const PALETTE = [
  'bg-rose-200 text-rose-800',
  'bg-amber-200 text-amber-800',
  'bg-emerald-200 text-emerald-800',
  'bg-sky-200 text-sky-800',
  'bg-indigo-200 text-indigo-800',
  'bg-purple-200 text-purple-800',
  'bg-pink-200 text-pink-800',
  'bg-teal-200 text-teal-800',
];

function hashName(name) {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % PALETTE.length;
}

function initials(name = '') {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0] || '').join('').toUpperCase() || '?';
}

const SIZES = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-xs',
  lg: 'w-12 h-12 text-sm',
  xl: 'w-16 h-16 text-base',
  '2xl': 'w-20 h-20 text-lg',
};

export default function Avatar({ src, name = '', size = 'md', className = '' }) {
  const sizeClass = SIZES[size] || SIZES.md;

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={`${sizeClass} rounded-full object-cover border border-zinc-100 ${className}`}
      />
    );
  }

  const palette = PALETTE[hashName(name)];
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold ${palette} ${className}`}
      aria-label={name}
    >
      {initials(name)}
    </div>
  );
}
