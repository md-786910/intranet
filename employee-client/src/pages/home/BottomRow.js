import React from 'react';
import MaterialIcon from '../../components/common/MaterialIcon';

const QUICK_LINKS = [
  { label: 'Employee Directory', icon: 'badge' },
  { label: 'Company Calendar', icon: 'calendar_month' },
  { label: 'IT Support Portal', icon: 'help_center' },
  { label: 'Payroll & Benefits', icon: 'request_quote' },
];

export default function BottomRow() {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-stretch">
      {/* Recent Activity */}
      <div className="lg:col-span-8 bg-white border border-zinc-100 rounded-3xl overflow-hidden shadow-sm flex flex-col">
        <div className="p-unit-lg border-b border-zinc-100 flex justify-between items-center">
          <h3 className="font-h3 text-h3">Recent Activity</h3>
          <div className="flex gap-2">
            <button className="p-2 hover:bg-zinc-50 rounded-lg transition-colors">
              <MaterialIcon name="filter_list" className="text-zinc-500" />
            </button>
            <button className="p-2 hover:bg-zinc-50 rounded-lg transition-colors">
              <MaterialIcon name="more_vert" className="text-zinc-500" />
            </button>
          </div>
        </div>
        <div className="divide-y divide-zinc-50 flex-grow">
          <ActivityRow
            iconBg="bg-blue-50"
            iconColor="text-blue-600"
            icon="edit_document"
            title="New Policy Drafted"
            description="Marketing Team updated the 'Global Branding Guidelines'"
            timestamp="10m ago"
          />
          <ActivityRow
            iconBg="bg-purple-50"
            iconColor="text-purple-600"
            icon="person_add"
            title="New Team Member"
            description="Lina Zhao joined the Product Design team"
            timestamp="1h ago"
          />
        </div>
        <div className="p-4 bg-zinc-50 flex justify-center mt-auto">
          <button
            type="button"
            className="text-primary font-semibold text-body-sm hover:underline"
          >
            View all activity
          </button>
        </div>
      </div>

      {/* Quick Links */}
      <div className="lg:col-span-4 bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
        <h3 className="font-h3 text-h3 mb-6">Quick Links</h3>
        <ul className="space-y-3 flex-grow">
          {QUICK_LINKS.map((link) => (
            <li key={link.label}>
              <a
                className="flex items-center gap-3 p-3 hover:bg-zinc-50 rounded-xl transition-colors border border-zinc-50"
                href="#"
              >
                <MaterialIcon name={link.icon} className="text-primary text-sm" />
                <span className="font-medium text-body-sm">{link.label}</span>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function ActivityRow({ iconBg, iconColor, icon, title, description, timestamp }) {
  return (
    <div className="p-6 hover:bg-zinc-50 transition-colors flex items-center gap-5">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${iconBg} ${iconColor}`}>
        <MaterialIcon name={icon} />
      </div>
      <div className="flex-grow">
        <p className="font-body-md font-semibold text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{description}</p>
      </div>
      <span className="text-body-sm text-zinc-400">{timestamp}</span>
    </div>
  );
}
