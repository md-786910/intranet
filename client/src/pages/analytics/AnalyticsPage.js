import React, { useState, useEffect, useCallback } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { analyticsService } from '../../services/analyticsService';
import { useToast } from '../../hooks/useToast';

/* ─── Helpers ───────────────────────────────────────────────────────────── */

function formatPeriod(raw, granularity) {
  if (!raw) return '—';
  const date = new Date(raw);
  if (isNaN(date)) return raw;
  if (granularity === 'month') {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (granularity === 'week') {
    return `w/c ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  // day
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ─── Shared UI helpers ─────────────────────────────────────────────────── */

function StatCard({ label, value, color = 'primary', icon }) {
  const colorMap = {
    primary: { num: 'text-primary-600', bg: 'bg-primary-50', border: 'border-primary-100' },
    green:   { num: 'text-green-600',   bg: 'bg-green-50',   border: 'border-green-100'   },
    purple:  { num: 'text-purple-600',  bg: 'bg-purple-50',  border: 'border-purple-100'  },
    orange:  { num: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-100'  },
    sky:     { num: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-100'     },
  };
  const c = colorMap[color] || colorMap.primary;
  return (
    <div className={`bg-white rounded-xl border ${c.border} p-5 flex items-start gap-4`}>
      {icon && (
        <div className={`${c.bg} rounded-lg p-2.5 flex-shrink-0`}>
          <svg className={`w-5 h-5 ${c.num}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        </div>
      )}
      <div>
        <div className={`text-2xl font-bold ${c.num}`}>{value ?? '—'}</div>
        <div className="text-xs text-gray-500 mt-0.5 font-medium">{label}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-2 mt-2 mb-3">
      <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

function GranularitySelector({ value, onChange }) {
  const options = [
    { label: 'Day',   value: 'day'   },
    { label: 'Week',  value: 'week'  },
    { label: 'Month', value: 'month' },
  ];
  return (
    <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
            value === opt.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DataTable({ columns, rows, emptyMessage = 'No data available' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50 border-y border-gray-100">
            {columns.map((col) => (
              <th key={col.key} className={`py-2.5 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap ${col.numeric ? 'text-center' : 'text-left'}`}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50/60 transition-colors">
              {columns.map((col) => {
                const val = col.render ? col.render(row) : (row[col.key] ?? '—');
                return (
                  <td key={col.key} className={`py-3 px-4 ${col.numeric ? 'text-center' : 'text-left'}`}>
                    {col.numeric ? (
                      <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-semibold tabular-nums">
                        {val}
                      </span>
                    ) : (
                      <span className="text-gray-700 font-medium">{val}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LoadingGrid({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />
      ))}
    </div>
  );
}

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <svg className="animate-spin w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

/* ─── Icon paths ────────────────────────────────────────────────────────── */
const ICONS = {
  users:    'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  active:   'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  office:   'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  vertical: 'M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z',
  dept:     'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
  news:     'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  docs:     'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  login:    'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  growth:   'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
};

/* ─── Tab content components ────────────────────────────────────────────── */

function OverviewTab({ dashboard }) {
  return (
    <div className="space-y-6">
      <div>
        <SectionLabel>Users</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Users"  value={dashboard.users?.total_users}  color="primary" icon={ICONS.users}  />
          <StatCard label="Active Users" value={dashboard.users?.active_users} color="green"   icon={ICONS.active} />
        </div>
      </div>

      <div>
        <SectionLabel>Organisation</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Office Locations" value={dashboard.organisation?.office_locations} color="purple" icon={ICONS.office}   />
          <StatCard label="Verticals"         value={dashboard.organisation?.verticals}        color="orange" icon={ICONS.vertical} />
          <StatCard label="Departments"       value={dashboard.organisation?.departments}      color="sky"    icon={ICONS.dept}     />
        </div>
      </div>

      <div>
        <SectionLabel>Content</SectionLabel>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total Articles"    value={dashboard.news?.total}      color="green"   icon={ICONS.news} />
          <StatCard label="Published News"    value={dashboard.news?.published}  color="green"   icon={ICONS.news} />
          <StatCard label="Draft Articles"    value={dashboard.news?.draft}      color="orange"  icon={ICONS.news} />
          <StatCard label="Total Documents"   value={dashboard.documents?.total} color="purple"  icon={ICONS.docs} />
        </div>
      </div>
    </div>
  );
}

function ContentTab({ granularity, onGranularityChange }) {
  const { addToast } = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService.getContentAnalytics({ granularity })
      .then((res) => setData(res.data?.data))
      .catch(() => addToast('Failed to load content analytics', 'error'))
      .finally(() => setLoading(false));
  }, [granularity, addToast]);

  const totalNews = data?.news?.reduce((s, r) => s + Number(r.total || 0), 0) ?? 0;
  const totalDocs = data?.documents?.reduce((s, r) => s + Number(r.total || 0), 0) ?? 0;

  const newsColumns = [
    { key: 'period',    label: 'Period',    render: (r) => formatPeriod(r.period, granularity) },
    { key: 'total',     label: 'Total',     numeric: true },
    { key: 'published', label: 'Published', numeric: true },
    { key: 'draft',     label: 'Drafts',    numeric: true, render: (r) => Math.max(0, Number(r.total || 0) - Number(r.published || 0)) },
  ];
  const docColumns = [
    { key: 'period',    label: 'Period',    render: (r) => formatPeriod(r.period, granularity) },
    { key: 'total',     label: 'Total',     numeric: true },
    { key: 'published', label: 'Published', numeric: true },
  ];

  return (
    <div className="space-y-6">
      {/* Granularity + summary */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex gap-4 flex-wrap">
          <StatCard label="Total News Articles" value={loading ? '…' : totalNews} color="green"  icon={ICONS.news} />
          <StatCard label="Total Documents"     value={loading ? '…' : totalDocs} color="purple" icon={ICONS.docs} />
        </div>
        <GranularitySelector value={granularity} onChange={onGranularityChange} />
      </div>

      {loading ? <TabSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* News table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.news} />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">News Over Time</h3>
            </div>
            <DataTable columns={newsColumns} rows={data?.news} emptyMessage="No news data for this period" />
          </div>

          {/* Documents table */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.docs} />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">Documents Over Time</h3>
            </div>
            <DataTable columns={docColumns} rows={data?.documents} emptyMessage="No document data for this period" />
          </div>
        </div>
      )}
    </div>
  );
}

function UsersTab({ granularity, onGranularityChange }) {
  const { addToast } = useToast();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService.getUserAnalytics({ granularity })
      .then((res) => setData(res.data?.data))
      .catch(() => addToast('Failed to load user analytics', 'error'))
      .finally(() => setLoading(false));
  }, [granularity, addToast]);

  const totalNewUsers = data?.userGrowth?.reduce((s, r) => s + Number(r.new_users || 0), 0) ?? 0;
  const totalLogins   = data?.loginActivity?.reduce((s, r) => s + Number(r.logins || 0), 0) ?? 0;

  const growthColumns = [
    { key: 'period',    label: 'Period',    render: (r) => formatPeriod(r.period, granularity) },
    { key: 'new_users', label: 'New Users', numeric: true },
  ];
  const loginColumns = [
    { key: 'period', label: 'Period', render: (r) => formatPeriod(r.period, granularity) },
    { key: 'logins', label: 'Logins', numeric: true },
  ];

  return (
    <div className="space-y-6">
      {/* Summary + granularity */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 flex-wrap">
          <StatCard label="Total New Users" value={loading ? '…' : totalNewUsers} color="primary" icon={ICONS.growth} />
          <StatCard label="Total Logins"    value={loading ? '…' : totalLogins}   color="sky"     icon={ICONS.login}  />
        </div>
        <GranularitySelector value={granularity} onChange={onGranularityChange} />
      </div>

      {loading ? <TabSpinner /> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User growth */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.growth} />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">User Growth</h3>
            </div>
            <DataTable columns={growthColumns} rows={data?.userGrowth} emptyMessage="No growth data for this period" />
          </div>

          {/* Login activity */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <svg className="w-4 h-4 text-sky-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.login} />
              </svg>
              <h3 className="text-sm font-semibold text-gray-800">Login Activity</h3>
            </div>
            <DataTable columns={loginColumns} rows={data?.loginActivity} emptyMessage="No login data for this period" />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────────────────── */

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'content',  label: 'Content'  },
  { key: 'users',    label: 'Users'    },
];

export default function AnalyticsPage() {
  const { addToast } = useToast();
  const [tab, setTab]             = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [dashLoading, setDashLoading] = useState(true);
  const [granularity, setGranularity] = useState('month');

  useEffect(() => {
    analyticsService.getDashboard()
      .then((res) => setDashboard(res.data?.data))
      .catch(() => addToast('Failed to load analytics', 'error'))
      .finally(() => setDashLoading(false));
  }, [addToast]);

  const handleGranularityChange = useCallback((g) => setGranularity(g), []);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Platform metrics and insights" />

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-5 py-1.5 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        dashLoading
          ? <LoadingGrid count={9} />
          : dashboard
            ? <OverviewTab dashboard={dashboard} />
            : <p className="text-sm text-gray-400">No data available.</p>
      )}

      {tab === 'content' && (
        <ContentTab granularity={granularity} onGranularityChange={handleGranularityChange} />
      )}

      {tab === 'users' && (
        <UsersTab granularity={granularity} onGranularityChange={handleGranularityChange} />
      )}
    </div>
  );
}
