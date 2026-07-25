import React from 'react';
import { Link } from 'react-router-dom';
import Select from './Select';

/**
 * Select with a "create …" link (opens in a new tab) and a refresh control,
 * same pattern as Job Title on user create/edit.
 */
export default function ManageableSelect({
  label,
  name,
  value,
  onChange,
  options = [],
  placeholder,
  error,
  required,
  disabled,
  createTo,
  createLabel = 'Create',
  onRefresh,
  refreshing = false,
  className = '',
}) {
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label htmlFor={name} className="block text-sm font-medium text-gray-700">
          {label} {required && <span className="text-red-500">*</span>}
        </label>
        <div className="flex items-center gap-2">
          {createTo && (
            <Link
              to={createTo}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium text-primary-600 hover:text-primary-700"
            >
              {createLabel}
            </Link>
          )}
          {typeof onRefresh === 'function' && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing || disabled}
              className="p-1 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
              title={`Refresh ${String(label || 'options').toLowerCase()}`}
              aria-label={`Refresh ${String(label || 'options').toLowerCase()}`}
            >
              <svg
                className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
      <Select
        name={name}
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        error={error}
        disabled={disabled || refreshing}
      />
    </div>
  );
}
