import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { STORAGE } from '../data';

export default function CloudStorageCard() {
  return (
    <div className="bg-primary-fixed text-on-primary-fixed-variant rounded-2xl p-unit-lg border border-primary-container shadow-sm">
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 bg-white/40 rounded-full flex items-center justify-center">
          <MaterialIcon name="cloud_done" className="text-primary" />
        </div>
        <span className="bg-white/40 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
          Synced
        </span>
      </div>
      <h3 className="font-h3 text-h3 mb-1">Cloud Storage</h3>
      <p className="font-body-sm text-body-sm opacity-80 mb-6">
        Your workspace is automatically backed up to our secure enterprise cloud.
      </p>
      <div className="w-full bg-white/30 h-1.5 rounded-full overflow-hidden mb-2">
        <div
          className="bg-primary h-full"
          style={{ width: `${STORAGE.percent}%` }}
          aria-valuenow={STORAGE.percent}
          aria-valuemin={0}
          aria-valuemax={100}
          role="progressbar"
        />
      </div>
      <div className="flex justify-between text-[11px] font-bold">
        <span>
          {STORAGE.used} {STORAGE.unit} used
        </span>
        <span>
          {STORAGE.total} {STORAGE.unit} total
        </span>
      </div>
    </div>
  );
}
