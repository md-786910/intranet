import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { useToast } from '../../../hooks/useToast';

export default function AiDiscoveryCard() {
  const toast = useToast();
  return (
    <div className="bg-white border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)] relative overflow-hidden group">
      <div className="relative z-10">
        <span className="font-label-caps text-label-caps text-on-secondary-fixed-variant mb-2 block uppercase">
          Advanced Search
        </span>
        <h4 className="font-h3 text-h3 text-on-background mb-3">AI Discovery</h4>
        <p className="font-body-sm text-body-sm text-on-surface-variant mb-4">
          Find specific clauses across thousands of documents instantly using our
          new AI-powered search tool.
        </p>
        <button
          type="button"
          onClick={() => toast.info('AI Discovery coming soon.')}
          className="bg-inverse-surface text-inverse-on-surface px-4 py-2 rounded-lg font-semibold text-xs hover:opacity-90 transition-opacity"
        >
          Try Now
        </button>
      </div>
      <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform pointer-events-none">
        <MaterialIcon name="auto_awesome" className="text-6xl" />
      </div>
    </div>
  );
}
