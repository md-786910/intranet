import React from 'react';

const LIMIT_OPTIONS = [10, 20, 50, 100];

export default function Pagination({ page, totalPages, total, limit, onPageChange, onLimitChange }) {
  if (!total || total === 0) return null;

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm select-none">
      {/* Left: rows per page */}
      <div className="flex items-center gap-2">
        {onLimitChange ? (
          <>
            <span className="text-xs text-gray-500 whitespace-nowrap">Rows per page:</span>
            <select
              value={limit}
              onChange={(e) => onLimitChange(Number(e.target.value))}
              className="border border-gray-200 rounded-md text-sm px-3 py-1.5 bg-white text-gray-700 min-w-[72px] focus:outline-none focus:ring-1 focus:ring-primary-500 cursor-pointer"
            >
              {LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </>
        ) : (
          <span className="text-xs text-gray-400">&nbsp;</span>
        )}
      </div>

      {/* Centre: count */}
      <span className="text-gray-500 text-xs">
        Showing {start}–{end} of {total}
      </span>

      {/* Right: navigation */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Previous page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="px-3 py-1 text-xs text-gray-600 font-medium tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Next page"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
