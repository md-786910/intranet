import React from 'react';

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }) {
  if (!total || total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm mt-2">
      {/* Left: per-page + count */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-400 text-xs">Rows per page</span>
          <select
            value={limit}
            onChange={(e) => onLimitChange && onLimitChange(Number(e.target.value))}
            disabled={!onLimitChange}
            className="border border-gray-200 rounded-lg pl-2 pr-6 py-1 text-xs text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-primary-400 disabled:opacity-50 disabled:cursor-not-allowed min-w-[60px]"
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
        <span className="text-gray-400 text-xs hidden sm:block">|</span>
        <span className="text-gray-600 text-xs">
          Showing <span className="font-medium text-gray-800">{start}–{end}</span> of <span className="font-medium text-gray-800">{total}</span>
        </span>
      </div>

      {/* Right: navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          ← Prev
        </button>
        <span className="px-3 py-1.5 text-xs text-gray-600 font-medium min-w-[60px] text-center">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
