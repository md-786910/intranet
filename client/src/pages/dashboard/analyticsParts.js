import React, { useEffect, useState } from 'react';
import { analyticsService } from '../../services/analyticsService';
import { useToast } from '../../hooks/useToast';

export function formatPeriod(raw, granularity) {
  if (!raw) return '—';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  if (granularity === 'month') {
    return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  if (granularity === 'week') {
    return `w/c ${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ICONS = {
  users: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  active: 'M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  office: 'M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21',
  vertical: 'M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z',
  dept: 'M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776',
  news: 'M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z',
  docs: 'M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z',
  login: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
  growth: 'M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941',
  draft: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
};

const COLOR = {
  primary: { num: 'text-primary-700', bg: 'bg-primary-50', ring: 'ring-primary-100', icon: 'text-primary-600' },
  green: { num: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-100', icon: 'text-emerald-600' },
  slate: { num: 'text-slate-700', bg: 'bg-slate-50', ring: 'ring-slate-100', icon: 'text-slate-600' },
  amber: { num: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-100', icon: 'text-amber-600' },
  sky: { num: 'text-sky-700', bg: 'bg-sky-50', ring: 'ring-sky-100', icon: 'text-sky-600' },
  indigo: { num: 'text-indigo-700', bg: 'bg-indigo-50', ring: 'ring-indigo-100', icon: 'text-indigo-600' },
};

export function KpiCard({ label, value, color = 'primary', icon, hint }) {
  const c = COLOR[color] || COLOR.primary;
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-gray-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] ring-1 ${c.ring}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">{label}</p>
          <p className={`mt-2 text-3xl font-semibold tracking-tight tabular-nums ${c.num}`}>
            {value ?? '—'}
          </p>
          {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
        </div>
        {icon && (
          <div className={`${c.bg} rounded-xl p-2.5 shrink-0`}>
            <svg className={`w-5 h-5 ${c.icon}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

export function SectionLabel({ children, action }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-3 min-w-0">
        <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-gray-400">{children}</h3>
        <div className="h-px flex-1 bg-gray-100 min-w-[2rem]" />
      </div>
      {action}
    </div>
  );
}

export function GranularitySelector({ value, onChange }) {
  const options = [
    { label: 'Day', value: 'day' },
    { label: 'Week', value: 'week' },
    { label: 'Month', value: 'month' },
  ];
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-gray-100 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
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

export function DataTable({ columns, rows, emptyMessage = 'No data available' }) {
  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-14 text-gray-400">
        <svg className="w-8 h-8 mb-2 opacity-40" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 010 3.75H5.625a1.875 1.875 0 010-3.75z" />
        </svg>
        <p className="text-sm">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto -mx-1">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-gray-100">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`py-2.5 px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap ${
                  col.numeric ? 'text-right' : 'text-left'
                }`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-slate-50/80 transition-colors">
              {columns.map((col) => {
                const val = col.render ? col.render(row) : (row[col.key] ?? '—');
                return (
                  <td key={col.key} className={`py-3 px-3 ${col.numeric ? 'text-right' : 'text-left'}`}>
                    {col.numeric ? (
                      <span className="inline-flex min-w-[2rem] justify-end tabular-nums text-sm font-semibold text-gray-800">
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

export function Panel({ title, icon, iconClass = 'text-gray-500', children }) {
  return (
    <div className="rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
        {icon && (
          <svg className={`w-4 h-4 ${iconClass}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
          </svg>
        )}
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-24">
      <svg className="animate-spin w-7 h-7 text-primary-500" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

export function LoadingGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse bg-gray-100 rounded-2xl h-28" />
      ))}
    </div>
  );
}

export function OverviewSection({ dashboard }) {
  return (
    <div className="space-y-8">
      <div>
        <SectionLabel>People</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Total users" value={dashboard.users?.total_users} color="primary" icon={ICONS.users} />
          <KpiCard label="Active users" value={dashboard.users?.active_users} color="green" icon={ICONS.active} />
        </div>
      </div>

      <div>
        <SectionLabel>Organisation</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Office locations" value={dashboard.organisation?.office_locations} color="indigo" icon={ICONS.office} />
          <KpiCard label="Verticals" value={dashboard.organisation?.verticals} color="amber" icon={ICONS.vertical} />
          <KpiCard label="Departments" value={dashboard.organisation?.departments} color="sky" icon={ICONS.dept} />
        </div>
      </div>

      <div>
        <SectionLabel>Content inventory</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="News articles" value={dashboard.news?.total} color="green" icon={ICONS.news} />
          <KpiCard label="Published news" value={dashboard.news?.published} color="green" icon={ICONS.active} />
          <KpiCard label="Draft news" value={dashboard.news?.draft} color="amber" icon={ICONS.draft} />
          <KpiCard label="Documents" value={dashboard.documents?.total} color="slate" icon={ICONS.docs} />
        </div>
      </div>
    </div>
  );
}

export function ContentSection({ granularity, onGranularityChange }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
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
    { key: 'period', label: 'Period', render: (r) => formatPeriod(r.period, granularity) },
    { key: 'total', label: 'Total', numeric: true },
    { key: 'published', label: 'Published', numeric: true },
    {
      key: 'draft',
      label: 'Drafts',
      numeric: true,
      render: (r) => Math.max(0, Number(r.total || 0) - Number(r.published || 0)),
    },
  ];
  const docColumns = [
    { key: 'period', label: 'Period', render: (r) => formatPeriod(r.period, granularity) },
    { key: 'total', label: 'Total', numeric: true },
    { key: 'published', label: 'Published', numeric: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 flex-1 max-w-xl">
          <KpiCard label="News in range" value={loading ? '…' : totalNews} color="green" icon={ICONS.news} />
          <KpiCard label="Documents in range" value={loading ? '…' : totalDocs} color="slate" icon={ICONS.docs} />
        </div>
        <GranularitySelector value={granularity} onChange={onGranularityChange} />
      </div>

      {loading ? (
        <TabSpinner />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Panel title="News over time" icon={ICONS.news} iconClass="text-emerald-600">
            <DataTable columns={newsColumns} rows={data?.news} emptyMessage="No news data for this period" />
          </Panel>
          <Panel title="Documents over time" icon={ICONS.docs} iconClass="text-slate-600">
            <DataTable columns={docColumns} rows={data?.documents} emptyMessage="No document data for this period" />
          </Panel>
        </div>
      )}
    </div>
  );
}

export function UsersSection({ granularity, onGranularityChange }) {
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    analyticsService.getUserAnalytics({ granularity })
      .then((res) => setData(res.data?.data))
      .catch(() => addToast('Failed to load user analytics', 'error'))
      .finally(() => setLoading(false));
  }, [granularity, addToast]);

  const totalNewUsers = data?.userGrowth?.reduce((s, r) => s + Number(r.new_users || 0), 0) ?? 0;
  const totalLogins = data?.loginActivity?.reduce((s, r) => s + Number(r.logins || 0), 0) ?? 0;

  const growthColumns = [
    { key: 'period', label: 'Period', render: (r) => formatPeriod(r.period, granularity) },
    { key: 'new_users', label: 'New users', numeric: true },
  ];
  const loginColumns = [
    { key: 'period', label: 'Period', render: (r) => formatPeriod(r.period, granularity) },
    { key: 'logins', label: 'Logins', numeric: true },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-4 flex-1 max-w-xl">
          <KpiCard label="New users in range" value={loading ? '…' : totalNewUsers} color="primary" icon={ICONS.growth} />
          <KpiCard label="Logins in range" value={loading ? '…' : totalLogins} color="sky" icon={ICONS.login} />
        </div>
        <GranularitySelector value={granularity} onChange={onGranularityChange} />
      </div>

      {loading ? (
        <TabSpinner />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <Panel title="User growth" icon={ICONS.growth} iconClass="text-primary-600">
            <DataTable columns={growthColumns} rows={data?.userGrowth} emptyMessage="No growth data for this period" />
          </Panel>
          <Panel title="Login activity" icon={ICONS.login} iconClass="text-sky-600">
            <DataTable columns={loginColumns} rows={data?.loginActivity} emptyMessage="No login data for this period" />
          </Panel>
        </div>
      )}
    </div>
  );
}
