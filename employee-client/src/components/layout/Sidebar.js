import React from 'react';
import { NavLink } from 'react-router-dom';
import Logo from '../common/Logo';

const HomeIcon = (
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12L12 3l9.75 9M4.5 10.5V21h5.25v-6h4.5v6H19.5V10.5" />
  </svg>
);

const navItems = [
  { to: '/workspace', label: 'Home', icon: HomeIcon },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-5 border-b border-gray-200">
        <Logo size="md" />
        <p className="mt-1 text-xs text-gray-500 pl-12">Employee Workspace</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-200">
        <p className="text-xs text-gray-400">© 2026 BrightNOW</p>
      </div>
    </aside>
  );
}
