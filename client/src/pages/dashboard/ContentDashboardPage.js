import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import { priorityLaneClass } from '../../components/common/PriorityBadge';
import AudienceSummary from '../../components/common/AudienceSummary';
import { analyticsService } from '../../services/analyticsService';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../hooks/useToast';
import { formatRelativeTime, truncate } from '../../utils/formatters';
import { getErrorMessage, getUserFacingMessage } from '../../utils/errorUtils';

const PERIODS = [
  { key: '7d', label: 'Last 7 days' },
  { key: 'week', label: 'This week' },
  { key: '30d', label: 'Last 30 days' },
];

const TYPES = [
  { key: 'all', label: 'All' },
  { key: 'news', label: 'News' },
  { key: 'documents', label: 'Documents' },
  { key: 'announcements', label: 'Announcements' },
];

const ENTITY_META = {
  NEWS: { label: 'News', title: 'News', path: (id) => `/news/${id}/edit` },
  DOCUMENT: { label: 'Doc', title: 'Document', path: (id) => `/documents/${id}/edit` },
  ANNOUNCEMENT: { label: 'Ann', title: 'Announcement', path: (id) => `/announcements/${id}/edit` },
};

function FilterPills({ options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = opt.key === value;
        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              active
                ? 'border-primary-300 bg-primary-50 text-primary-800'
                : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function StatCard({ label, value, hint, iconPath }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-start gap-3">
        <div className="p-2.5 rounded-lg bg-primary-50 text-primary-600 flex-shrink-0">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 tracking-tight mt-0.5">{value ?? '—'}</p>
          {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
        </div>
      </div>
    </div>
  );
}

function ActivityBars({ series }) {
  const max = useMemo(() => {
    if (!series?.length) return 1;
    return Math.max(
      1,
      ...series.map((d) => (d.news || 0) + (d.documents || 0) + (d.announcements || 0)),
    );
  }, [series]);

  if (!series?.length) {
    return <p className="text-sm text-gray-400 py-8 text-center">No publish activity in this period.</p>;
  }

  return (
    <div className="flex items-end gap-1.5 h-36 pt-2">
      {series.map((day) => {
        const total = (day.news || 0) + (day.documents || 0) + (day.announcements || 0);
        const heightPct = Math.round((total / max) * 100);
        const label = day.date?.slice(5) || '';
        return (
          <div key={day.date} className="flex-1 min-w-0 flex flex-col items-center gap-1.5 h-full justify-end">
            <div
              className="w-full max-w-[28px] rounded-t-md bg-primary-500/80 hover:bg-primary-600 transition-colors"
              style={{ height: `${Math.max(total > 0 ? 8 : 2, heightPct)}%` }}
              title={`${day.date}: ${total} published (N ${day.news || 0} · D ${day.documents || 0} · A ${day.announcements || 0})`}
            />
            <span className="text-[10px] text-gray-400 truncate w-full text-center">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function ContentDashboardPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canViewNews } = usePermission('NEWS', 'VIEW');
  const { hasPermission: canViewDocs } = usePermission('DOCUMENTS', 'VIEW');
  const { hasPermission: canViewAnalytics } = usePermission('ADMIN', 'VIEW_ANALYTICS');

  const [period, setPeriod] = useState('7d');
  const [type, setType] = useState('all');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const canAccess = canViewNews || canViewDocs;

  const load = useCallback(async () => {
    if (!canAccess) return;
    setLoading(true);
    try {
      const res = await analyticsService.getContentWorkspace({ period, type });
      setData(res.data?.data || null);
    } catch (err) {
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to load content dashboard'), 'error');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [period, type, canAccess, addToast]);

  useEffect(() => {
    load();
  }, [load]);

  if (canViewAnalytics) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  const stats = data?.stats;
  const drafts = (stats?.news?.draft || 0)
    + (stats?.documents?.draft || 0)
    + (stats?.announcements?.draft || 0);
  const scheduled = (stats?.news?.scheduled || 0) + (stats?.announcements?.scheduled || 0);
  const publishedTotal = stats?.published_total ?? null;

  const typeOptions = TYPES.filter((t) => {
    if (t.key === 'all') return true;
    if (t.key === 'documents') return canViewDocs;
    return canViewNews;
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content dashboard"
        subtitle="Recent publishes and activity across news, documents, and announcements."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterPills options={PERIODS} value={period} onChange={setPeriod} />
        <FilterPills options={typeOptions} value={type} onChange={setType} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Published"
          value={loading ? null : publishedTotal}
          hint="In selected period"
          iconPath="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          label="Drafts"
          value={loading ? null : drafts}
          hint="Ready to finish"
          iconPath="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
        />
        <StatCard
          label="Scheduled"
          value={loading ? null : scheduled}
          hint="Queued to go live"
          iconPath="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <StatCard
          label="By type"
          value={loading ? null : `${stats?.news?.published ?? 0} / ${stats?.documents?.published ?? 0} / ${stats?.announcements?.published ?? 0}`}
          hint="News · Docs · Announcements"
          iconPath="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-1">Publish activity</h2>
          <p className="text-xs text-gray-500 mb-4">Daily publishes in the selected period.</p>
          {loading ? (
            <div className="h-36 flex items-center justify-center text-sm text-gray-400">Loading…</div>
          ) : (
            <ActivityBars series={data?.series || []} />
          )}
        </div>

        <div className="lg:col-span-3 bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <div className="mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recently published</h2>
            <p className="text-xs text-gray-500 mt-0.5">Latest live content in your scope.</p>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 py-10 text-center">Loading…</p>
          ) : !data?.recent?.length ? (
            <p className="text-sm text-gray-400 py-10 text-center">Nothing published yet in this view.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 -mx-5">
                {data.recent.slice(0, 5).map((item) => {
                  const meta = ENTITY_META[item.entity_type] || ENTITY_META.NEWS;
                  const lane = priorityLaneClass(item.priority);
                  return (
                    <li
                      key={`${item.entity_type}-${item.id}`}
                      className={`px-5 py-2.5 ${lane}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="flex-shrink-0 text-[10px] font-semibold uppercase tracking-wide text-gray-400 w-10"
                          title={meta.title}
                        >
                          {meta.label}
                        </span>
                        <Link
                          to={meta.path(item.id)}
                          className="min-w-0 flex-1 text-sm font-medium text-gray-900 hover:text-primary-700 truncate"
                        >
                          {truncate(item.title || 'Untitled', 72)}
                        </Link>
                        <span className="flex-shrink-0 text-xs text-gray-400 tabular-nums">
                          {item.published_at ? formatRelativeTime(item.published_at) : '—'}
                        </span>
                      </div>
                      <div className="pl-[2.75rem] mt-0.5">
                        <AudienceSummary audience_summary={item.audience_summary} />
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="pt-3 mt-1 border-t border-gray-100">
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full justify-center"
                  onClick={() => {
                    if (type === 'news') navigate('/news');
                    else if (type === 'documents') navigate('/documents');
                    else if (type === 'announcements') navigate('/announcements');
                    else navigate('/activity');
                  }}
                >
                  View more
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
