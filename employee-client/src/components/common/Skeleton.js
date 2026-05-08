import React from 'react';

export default function Skeleton({ className = '' }) {
  return (
    <div
      className={`bg-surface-container-low animate-pulse rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
