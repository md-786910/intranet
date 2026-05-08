import React, { useRef, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import FilterPopover from './FilterPopover';
import { useDocumentsFilters } from '../FiltersContext';

export default function ResourceLibraryHeader({
  title = 'Resource Library',
  subtitle = 'Central hub for all company documentation, assets, and guidelines.',
  categories = [],
  leadingNode = null,
}) {
  const { activeCount } = useDocumentsFilters();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div className="space-y-unit-xs">
        {leadingNode}
        <h1 className="font-h1 text-h1 text-on-background">{title}</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">{subtitle}</p>
      </div>
      <div className="flex items-center gap-unit-md relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="dialog"
          className={`relative flex items-center gap-2 px-unit-lg py-2 border rounded-lg transition-colors font-body-sm text-body-sm ${
            activeCount > 0
              ? 'border-primary bg-primary-container/30 text-on-background'
              : 'border-outline-variant hover:bg-surface-variant'
          }`}
        >
          <MaterialIcon name="filter_list" className="text-sm" />
          Filter
          {activeCount > 0 && (
            <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-on-primary font-label-caps text-label-caps">
              {activeCount}
            </span>
          )}
        </button>
        <FilterPopover
          open={open}
          onClose={() => setOpen(false)}
          anchorRef={buttonRef}
          categories={categories}
        />
      </div>
    </div>
  );
}
