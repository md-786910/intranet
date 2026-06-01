import React, { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';

function CacheRow({ label, ttl }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{ttl}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { addToast: showToast } = useToast();
  const [clearing, setClearing] = useState(false);

  async function handleClearCache() {
    setClearing(true);
    try {
      await azureAdService.clearCache();
      showToast('Active Directory cache cleared. Next page load will re-fetch from Microsoft.', 'success');
    } catch {
      showToast('Failed to clear cache. Please try again.', 'error');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        subtitle="System configuration"
      />

      {/* Active Directory Cache */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
              <svg className="w-5 h-5 text-indigo-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">Active Directory Cache</p>
              <p className="text-xs text-gray-400">Microsoft Entra ID — Azure AD data is cached in Redis for fast loading</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Cache keys &amp; TTLs</p>
          <div className="mb-5">
            <CacheRow label="All users list"    ttl="24 hours" />
            <CacheRow label="Org tree roots"    ttl="24 hours" />
            <CacheRow label="Direct reports"    ttl="24 hours" />
            <CacheRow label="User detail"       ttl="24 hours" />
            <CacheRow label="Departments list"  ttl="24 hours" />
          </div>

          <div className="rounded-lg bg-amber-50 border border-amber-100 px-4 py-3 mb-5">
            <p className="text-sm text-amber-700">
              Azure AD data is served from cache for up to 24 hours. If you make changes in Microsoft Entra ID
              (new users, updated titles, org restructure), clear the cache here so the next page load reflects
              the latest data.
            </p>
          </div>

          <button
            onClick={handleClearCache}
            disabled={clearing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-red-200 text-red-600 bg-white hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {clearing ? (
              <>
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                Clearing…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Clear Active Directory Cache
              </>
            )}
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Clears all cached Azure AD data. The next page load will re-fetch live data from Microsoft.
          </p>
        </div>
      </div>
    </div>
  );
}
