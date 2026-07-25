import React, { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { analyticsService } from '../../services/analyticsService';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import {
  ContentSection,
  ICONS,
  KpiCard,
  LoadingGrid,
  OverviewSection,
  UsersSection,
} from './analyticsParts';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'content', label: 'Content' },
  { key: 'users', label: 'Users' },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const { currentOrganisationName } = useCurrentOrganisation();
  const { hasPermission: canViewAnalytics } = usePermission('ADMIN', 'VIEW_ANALYTICS');

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
  const [granularity, setGranularity] = useState('month');

  useEffect(() => {
    if (!canViewAnalytics) return undefined;
    let cancelled = false;
    setLoading(true);
    analyticsService.getDashboard()
      .then((res) => {
        if (!cancelled) setDashboard(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) addToast('Failed to load dashboard analytics', 'error');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [canViewAnalytics, addToast]);

  const handleGranularityChange = useCallback((g) => setGranularity(g), []);

  if (!canViewAnalytics) {
    return <Navigate to="/" replace />;
  }

  const displayName = [user?.first_name, user?.last_name].filter(Boolean).join(' ')
    || user?.email
    || 'there';

  return (
    <div className="max-w-[1400px]">
      {/* Header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-primary-600 mb-2">
            Platform analytics
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="mt-1.5 text-sm text-gray-500 max-w-xl">
            Welcome back, {displayName}
            {currentOrganisationName ? (
              <>
                {' · '}
                <span className="font-medium text-gray-700">{currentOrganisationName}</span>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 self-start sm:self-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                tab === t.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* At-a-glance strip — always visible */}
      {loading ? (
        <LoadingGrid count={4} />
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <KpiCard
            label="Total users"
            value={dashboard?.users?.total_users}
            color="primary"
            icon={ICONS.users}
            hint={`${dashboard?.users?.active_users ?? 0} active`}
          />
          <KpiCard
            label="Published news"
            value={dashboard?.news?.published}
            color="green"
            icon={ICONS.news}
            hint={`${dashboard?.news?.draft ?? 0} in draft`}
          />
          <KpiCard
            label="Documents"
            value={dashboard?.documents?.total}
            color="slate"
            icon={ICONS.docs}
          />
          <KpiCard
            label="Departments"
            value={dashboard?.organisation?.departments}
            color="amber"
            icon={ICONS.dept}
            hint={`${dashboard?.organisation?.office_locations ?? 0} offices`}
          />
        </div>
      )}

      {/* Detail panels */}
      <div className="rounded-2xl border border-gray-200/80 bg-gradient-to-b from-slate-50/80 to-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(16,24,40,0.03)]">
        {tab === 'overview' && (
          loading
            ? <LoadingGrid count={8} />
            : dashboard
              ? <OverviewSection dashboard={dashboard} />
              : <p className="text-sm text-gray-400 py-12 text-center">No analytics data available yet.</p>
        )}
        {tab === 'content' && (
          <ContentSection granularity={granularity} onGranularityChange={handleGranularityChange} />
        )}
        {tab === 'users' && (
          <UsersSection granularity={granularity} onGranularityChange={handleGranularityChange} />
        )}
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Signed in as <span className="font-medium text-gray-500">{user?.email}</span>
      </p>
    </div>
  );
}
