import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';

const ITEMS = [
  { label: 'People', icon: 'groups', to: '/people' },
  { label: 'News', icon: 'article', to: '/news' },
  { label: 'Documents', icon: 'folder_open', to: '/documents' },
  { label: 'Policies', icon: 'policy', to: '/policies' },
  { label: 'Org Chart', icon: 'account_tree', to: '/org-chart' },
];

export default function QuickAccessGrid() {
  return (
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6 lg:gap-8">
      {ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className="group">
          <div className="bg-white/70 backdrop-blur-sm border border-zinc-100 p-8 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col items-center justify-center transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] hover:-translate-y-2 hover:bg-white active:scale-95">
            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center mb-5 group-hover:bg-indigo-100 transition-colors duration-300">
              <MaterialIcon
                name={item.icon}
                className="text-indigo-600 !text-3xl group-hover:scale-110 transition-transform duration-300"
              />
            </div>
            <span className="font-bold text-zinc-800 text-lg tracking-tight group-hover:text-indigo-600 transition-colors">
              {item.label}
            </span>
          </div>
        </Link>
      ))}
    </section>
  );
}
