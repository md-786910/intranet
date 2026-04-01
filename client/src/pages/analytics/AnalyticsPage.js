import React, { useState, useEffect } from 'react';
import PageHeader from '../../components/common/PageHeader';
import { analyticsService } from '../../services/analyticsService';
import { useToast } from '../../hooks/useToast';

const DEFAULT_ORG_UNIT_ID = 1;

function StatCard({ label, value, color = 'primary' }) {
  const colorMap = {
    primary: 'bg-primary-50 text-primary-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className={`text-3xl font-bold ${colorMap[color]?.split(' ')[1] || 'text-gray-900'}`}>
        {value ?? '—'}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

export default function AnalyticsPage() {
  const { addToast } = useToast();
  const [tab, setTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analyticsService.getDashboard({ org_unit_id: DEFAULT_ORG_UNIT_ID })
      .then((res) => setDashboard(res.data?.data))
      .catch(() => addToast('Failed to load analytics', 'error'))
      .finally(() => setLoading(false));
  }, [addToast]);

  const tabs = ['overview', 'content', 'users', 'push'];

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Platform metrics and insights" />

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
        {tabs.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md capitalize transition-colors ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-24" />
          ))}
        </div>
      ) : tab === 'overview' && dashboard ? (
        <div className="space-y-6">
          <h3 className="text-sm font-medium text-gray-700">Users</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Users" value={dashboard.users?.total_users} color="primary" />
            <StatCard label="Active Users" value={dashboard.users?.active_users} color="green" />
          </div>

          <h3 className="text-sm font-medium text-gray-700">Organisation</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Office Locations" value={dashboard.organisation?.office_locations} color="purple" />
            <StatCard label="Verticals" value={dashboard.organisation?.verticals} color="orange" />
            <StatCard label="Departments" value={dashboard.organisation?.departments} color="primary" />
          </div>

          <h3 className="text-sm font-medium text-gray-700">Content</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="News Articles" value={dashboard.news?.total} color="green" />
            <StatCard label="Published News" value={dashboard.news?.published} color="green" />
            <StatCard label="Documents" value={dashboard.documents?.total} color="purple" />
            <StatCard label="Push Campaigns" value={dashboard.push?.total} color="orange" />
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-500">
          <p className="text-sm">Detailed {tab} analytics will be available as more data is collected.</p>
        </div>
      )}
    </div>
  );
}
