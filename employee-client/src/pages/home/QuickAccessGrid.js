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
    <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4 lg:gap-gutter">
      {ITEMS.map((item) => (
        <Link key={item.to} to={item.to} className="group cursor-pointer">
          <div className="bg-white border border-zinc-100 p-6 rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.04)] text-center transition-all group-hover:-translate-y-1 group-hover:shadow-md">
            <div className="w-12 h-12 bg-primary-container/20 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-primary-container transition-colors">
              <MaterialIcon
                name={item.icon}
                className="text-primary group-hover:text-on-primary-container"
              />
            </div>
            <span className="font-semibold text-body-md block">{item.label}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}
