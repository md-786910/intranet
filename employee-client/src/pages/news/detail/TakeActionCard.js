import React from 'react';
import { useToast } from '../../../hooks/useToast';

// Static "Take Action" sidebar card + Sustainability Metrics.
// Buttons toast "coming soon" until the backend supports article-attached CTAs.
export default function TakeActionCard() {
  const toast = useToast();
  const stub = (label) => () => toast.info(`${label} coming soon.`);

  return (
    <>
      {/* Take Action Card */}
      <div className="p-unit-lg bg-surface-container-low rounded-xl border border-outline-variant">
        <h4 className="font-h3 text-h3 text-on-surface mb-unit-md">Take Action</h4>
        <p className="text-body-sm text-on-surface-variant mb-unit-lg">
          Ready to contribute to our sustainability goals? Join the ESG Task
          Force or download our Green Office Guide.
        </p>
        <button
          type="button"
          onClick={stub('Resource downloads')}
          className="w-full bg-primary-container text-on-primary-container font-semibold py-unit-sm px-unit-lg rounded-lg hover:opacity-90 transition-opacity"
        >
          Download Green Guide
        </button>
        <button
          type="button"
          onClick={stub('Contact requests')}
          className="w-full mt-unit-sm bg-transparent border border-outline text-on-surface font-semibold py-unit-sm px-unit-lg rounded-lg hover:bg-white transition-colors"
        >
          Apply for Task Force
        </button>
      </div>

      {/* Sustainability Metrics Card */}
      <div className="p-unit-lg bg-white rounded-xl border border-outline-variant shadow-sm">
        <h4 className="font-h3 text-h3 text-on-surface mb-unit-md">
          Sustainability Metrics
        </h4>
        <div className="space-y-unit-md">
          <div>
            <div className="flex justify-between text-body-sm mb-1">
              <span>Energy Reduction</span>
              <span className="font-bold">24%</span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '24%' }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-body-sm mb-1">
              <span>Waste Diversion</span>
              <span className="font-bold">68%</span>
            </div>
            <div className="w-full bg-surface-container-high h-2 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-500" style={{ width: '68%' }} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
