import React, { useEffect, useMemo, useRef, useState } from 'react';

function useOutsideClick(ref, onOutsideClick, enabled) {
  useEffect(() => {
    if (!enabled) return undefined;

    const handleClickOutside = (event) => {
      if (!ref.current || ref.current.contains(event.target)) return;
      onOutsideClick();
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [enabled, onOutsideClick, ref]);
}

export default function MultiSelect({
  label,
  name,
  value = [],
  onChange,
  options = [],
  error,
  placeholder = 'Select options...',
  disabled = false,
  helpText,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useOutsideClick(rootRef, () => setOpen(false), open);

  const selectedOptions = useMemo(
    () => options.filter((option) => value.includes(String(option.value))),
    [options, value],
  );

  const toggleValue = (optionValue) => {
    if (!onChange) return;
    const nextValue = value.includes(optionValue)
      ? value.filter((item) => item !== optionValue)
      : [...value, optionValue];
    onChange(nextValue);
  };

  return (
    <div className={className} ref={rootRef}>
      {label && (
        <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}

      <div className="relative">
        <button
          id={name}
          type="button"
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          className={`w-full min-h-[42px] px-3 py-2 border rounded-lg text-sm text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${open ? 'ring-2 ring-primary-500 border-primary-500' : ''}`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              {selectedOptions.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {selectedOptions.slice(0, 3).map((option) => (
                    <span
                      key={option.value}
                      className="inline-flex items-center rounded-md bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700"
                    >
                      {option.label}
                    </span>
                  ))}
                  {selectedOptions.length > 3 && (
                    <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">
                      +{selectedOptions.length - 3} more
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-gray-400">{placeholder}</span>
              )}
            </div>
            <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>

        {open && !disabled && (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg">
            <div className="max-h-64 overflow-y-auto py-1">
              {options.map((option) => {
                const checked = value.includes(String(option.value));
                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleValue(String(option.value))}
                      className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="min-w-0">
                      <span className="block text-gray-900">{option.label}</span>
                      {option.description && (
                        <span className="block text-xs text-gray-500">{option.description}</span>
                      )}
                    </span>
                  </label>
                );
              })}
              {options.length === 0 && (
                <div className="px-3 py-3 text-sm text-gray-400">No options available</div>
              )}
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      {helpText && !error && <p className="mt-1 text-xs text-gray-500">{helpText}</p>}
    </div>
  );
}
