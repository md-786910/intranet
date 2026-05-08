import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';

export default function ResourceLibraryHeader() {
  const toast = useToast();
  const stub = (label) => () => toast.info(`${label} coming soon.`);

  return (
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div className="space-y-unit-xs">
        <h1 className="font-h1 text-h1 text-on-background">Resource Library</h1>
        <p className="font-body-md text-body-md text-on-surface-variant">
          Central hub for all company documentation, assets, and guidelines.
        </p>
      </div>
      <div className="flex items-center gap-unit-md">
        <button
          type="button"
          onClick={stub('Filtering')}
          className="flex items-center gap-2 px-unit-lg py-2 border border-outline-variant rounded-lg hover:bg-surface-variant transition-colors font-body-sm text-body-sm"
        >
          <MaterialIcon name="filter_list" className="text-sm" />
          Filter
        </button>
        <button
          type="button"
          onClick={stub('Document upload')}
          className="bg-primary-container text-on-background font-semibold px-unit-lg py-2 rounded-lg hover:opacity-90 transition-all flex items-center gap-2 shadow-sm font-body-sm text-body-sm"
        >
          <MaterialIcon name="upload" className="text-sm" />
          Upload New
        </button>
      </div>
    </div>
  );
}
