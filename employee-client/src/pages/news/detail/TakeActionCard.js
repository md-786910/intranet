import React from 'react';
import { useToast } from '../../../hooks/useToast';

// Static "Take Action" sidebar card. Buttons toast "coming soon" until the
// backend supports article-attached CTAs.
export default function TakeActionCard() {
  const toast = useToast();
  const stub = (label) => () => toast.info(`${label} coming soon.`);

  return (
    <div className="p-unit-lg bg-surface-container-low rounded-xl border border-outline-variant">
      <h4 className="font-h3 text-h3 text-on-surface mb-unit-md">Take Action</h4>
      <p className="text-body-sm text-on-surface-variant mb-unit-lg">
        Want to get involved? Reach out to the team or download the relevant
        guide.
      </p>
      <button
        type="button"
        onClick={stub('Resource downloads')}
        className="w-full bg-primary-container text-on-primary-container font-semibold py-unit-sm px-unit-lg rounded-lg hover:opacity-90 transition-opacity"
      >
        Download Guide
      </button>
      <button
        type="button"
        onClick={stub('Contact requests')}
        className="w-full mt-unit-sm bg-transparent border border-outline text-on-surface font-semibold py-unit-sm px-unit-lg rounded-lg hover:bg-white transition-colors"
      >
        Contact Team
      </button>
    </div>
  );
}
