import React, { useEffect, useRef, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useDocumentsFilters } from '../FiltersContext';
import { FILE_TYPE_CHIPS, PRIORITY_CHIPS } from '../documentActions';

function Chip({ active, onClick, children, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border font-body-sm text-body-sm transition-colors ${
        active
          ? 'bg-primary text-on-primary border-primary'
          : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:bg-surface-variant/40'
      }`}
    >
      {icon ? <MaterialIcon name={icon} className="text-sm" /> : null}
      {children}
    </button>
  );
}

export default function FilterPopover({ open, onClose, anchorRef, categories = [] }) {
  const { filters, setFilters, resetFilters, availableDimensions } = useDocumentsFilters();
  const popoverRef = useRef(null);
  const [search, setSearch] = useState(filters.search);

  // Debounce search → context
  useEffect(() => {
    const t = setTimeout(() => setFilters({ search }), 250);
    return () => clearTimeout(t);
  }, [search, setFilters]);

  // Sync local search input when filters reset externally
  useEffect(() => {
    if (filters.search === '' && search !== '') setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

  // Close on outside click
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (popoverRef.current?.contains(e.target)) return;
      if (anchorRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open, onClose, anchorRef]);

  // Close on escape
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggle = (key, value) => {
    setFilters((prev) => {
      const list = prev[key];
      const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  return (
    <div
      ref={popoverRef}
      className="absolute right-0 top-full mt-2 w-[360px] max-w-[calc(100vw-2rem)] bg-surface-container-lowest border border-outline-variant/40 rounded-2xl shadow-xl p-unit-lg z-50"
      role="dialog"
      aria-label="Filter documents"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-h3 text-h3 text-on-background">Filter</h3>
        <button
          type="button"
          onClick={() => { setSearch(''); resetFilters(); }}
          className="text-primary font-semibold font-body-sm text-body-sm hover:underline"
        >
          Reset
        </button>
      </div>

      {availableDimensions.search && (
        <div className="mb-4">
          <label htmlFor="doc-filter-search" className="block font-label-caps text-label-caps text-on-surface-variant mb-1.5">
            Search by name
          </label>
          <div className="relative">
            <MaterialIcon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm pointer-events-none" />
            <input
              id="doc-filter-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="e.g. policy, brand, expense…"
              className="w-full pl-10 pr-3 py-2 border border-outline-variant rounded-lg bg-surface-container-lowest font-body-sm text-body-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>
      )}

      {availableDimensions.categoryIds && categories.length > 0 && (
        <div className="mb-4">
          <p className="font-label-caps text-label-caps text-on-surface-variant mb-1.5">Category</p>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Chip
                key={c.category_id}
                active={filters.categoryIds.includes(c.category_id)}
                onClick={() => toggle('categoryIds', c.category_id)}
              >
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {availableDimensions.priorities && (
        <div className="mb-4">
          <p className="font-label-caps text-label-caps text-on-surface-variant mb-1.5">Priority</p>
          <div className="flex flex-wrap gap-2">
            {PRIORITY_CHIPS.map((p) => (
              <Chip
                key={p.id}
                active={filters.priorities.includes(p.id)}
                onClick={() => toggle('priorities', p.id)}
              >
                {p.label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {availableDimensions.fileTypes && (
        <div>
          <p className="font-label-caps text-label-caps text-on-surface-variant mb-1.5">File Type</p>
          <div className="flex flex-wrap gap-2">
            {FILE_TYPE_CHIPS.map((f) => (
              <Chip
                key={f.id}
                icon={f.icon}
                active={filters.fileTypes.includes(f.id)}
                onClick={() => toggle('fileTypes', f.id)}
              >
                {f.label}
              </Chip>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
