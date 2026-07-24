import React, { useEffect, useRef } from 'react';

/**
 * Professional Entra-style field row with optional inline select editing.
 * View: label | value (+ status) | link to org tree | edit affordance
 * Edit: label | select + Cancel  (saves on change)
 */
export default function InlineEditableSelect({
  label,
  valueLabel,
  status = 'empty', // 'linked' | 'unmatched' | 'empty'
  unmatchedSource,
  options = [],
  value = '',
  editing = false,
  saving = false,
  emptyHint = 'Not set',
  editTitle = 'Change selection',
  onStartEdit,
  onCancel,
  onSelect,
}) {
  const selectRef = useRef(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  return (
    <div className="group flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 py-3 border-b border-gray-100 last:border-0">
      <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide">
        {label}
      </dt>
      <dd className="flex-1 min-w-0">
        {editing ? (
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0 max-w-sm">
              <select
                ref={selectRef}
                disabled={saving}
                value={value}
                onChange={(e) => onSelect?.(e.target.value)}
                className="w-full appearance-none bg-white pl-3 pr-9 py-2 border border-primary-300 rounded-lg text-sm text-gray-900 shadow-sm
                  focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500
                  disabled:opacity-60 disabled:cursor-wait"
              >
                <option value="">{emptyHint}</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <svg
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={onCancel}
              className="text-xs font-medium text-gray-500 hover:text-gray-800 px-2 py-1.5 rounded-md hover:bg-gray-100 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            {saving && (
              <span className="text-xs text-gray-400 tabular-nums">Saving…</span>
            )}
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {status === 'empty' ? (
                <span className="text-sm text-gray-400 italic">{emptyHint}</span>
              ) : (
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">{valueLabel}</span>
                    {status === 'linked' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 border border-emerald-100 rounded px-1.5 py-0.5">
                        Linked
                      </span>
                    )}
                    {status === 'unmatched' && (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-700 bg-amber-50 border border-amber-100 rounded px-1.5 py-0.5">
                        Unmatched
                      </span>
                    )}
                  </div>
                  {status === 'unmatched' && unmatchedSource && (
                    <p className="text-xs text-gray-400">
                      From Entra — link to an org unit to sync membership
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              {typeof onStartEdit === 'function' && (
                <button
                  type="button"
                  title={editTitle}
                  onClick={onStartEdit}
                  className="p-1.5 rounded-md text-gray-300 hover:text-primary-600 hover:bg-primary-50
                    sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100 focus:opacity-100
                    transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
                  </svg>
                  <span className="sr-only">{editTitle}</span>
                </button>
              )}
            </div>
          </div>
        )}
      </dd>
    </div>
  );
}
