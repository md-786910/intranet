import React, { useContext, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PermissionContext } from '../../contexts/PermissionContext';

const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  organisation: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  roles: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  news: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  documents: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  media: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  employees: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m4 0a4 4 0 100-8 4 4 0 000 8zm6-2a4 4 0 11-8 0 4 4 0 018 0zM9 7a3 3 0 11-6 0 3 3 0 016 0z',
  categories: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  settings: 'M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z',
  push: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
};

const menuItems = [
  { type: 'link', label: 'Dashboard', path: '/dashboard', icon: ICONS.dashboard, module: 'ADMIN', action: 'VIEW_ANALYTICS' },
  {
    type: 'group',
    label: 'Organisation',
    icon: ICONS.organisation,
    defaultOpen: false,
    children: [
      { label: 'Organisation Tree', path: '/organisation', icon: ICONS.organisation, module: 'ADMIN', action: 'MANAGE_OFFICE_LOCATIONS' },
      { label: 'Users', path: '/users', icon: ICONS.users, module: 'ADMIN', action: 'MANAGE_USERS' },
      { label: 'Roles', path: '/roles', icon: ICONS.roles, module: 'ADMIN', action: 'MANAGE_ROLES' },
    ],
  },
  {
    type: 'group',
    label: 'Content',
    icon: ICONS.news,
    defaultOpen: false,
    children: [
      { label: 'News', path: '/news', icon: ICONS.news, module: 'NEWS', action: 'VIEW' },
      { label: 'Documents', path: '/documents', icon: ICONS.documents, module: 'DOCUMENTS', action: 'VIEW' },
      {
        label: 'Categories',
        path: '/categories',
        icon: ICONS.categories,
        anyOf: [
          { module: 'NEWS', action: 'EDIT' },
          { module: 'DOCUMENTS', action: 'EDIT' },
        ],
      },
      {
        label: 'Media',
        path: '/media',
        icon: ICONS.media,
        anyOf: [
          { module: 'DOCUMENTS', action: 'CREATE' },
          { module: 'NEWS', action: 'CREATE' },
        ],
      },
    ],
  },
  {
    type: 'group',
    label: 'Employee Management',
    icon: ICONS.employees,
    defaultOpen: false,
    children: [
      { label: 'Manage Employees', path: '/employees', icon: ICONS.employees, module: 'ADMIN', action: 'MANAGE_EMPLOYEES' },
    ],
  },
  {
    type: 'group',
    label: 'Settings',
    icon: ICONS.settings,
    defaultOpen: false,
    children: [
      { label: 'Push', path: '/push', icon: ICONS.push, module: 'PUSH', action: 'VIEW' },
      { label: 'Analytics', path: '/analytics', icon: ICONS.analytics, module: 'ADMIN', action: 'VIEW_ANALYTICS' },
    ],
  },
];

function MenuLink({ item, indented = false }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
          indented ? 'pl-9' : ''
        } ${
          isActive
            ? 'bg-primary-50 text-primary-700'
            : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
        }`
      }
    >
      <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
      </svg>
      {item.label}
    </NavLink>
  );
}

function isItemVisible(item, hasPermission) {
  if (Array.isArray(item.anyOf) && item.anyOf.length > 0) {
    return item.anyOf.some((p) => hasPermission(p.module, p.action));
  }
  return hasPermission(item.module, item.action);
}

function TopLevelLink({ item }) {
  const { hasPermission } = useContext(PermissionContext);
  if (!isItemVisible(item, hasPermission)) return null;
  return <MenuLink item={item} />;
}

function MenuGroup({ group }) {
  const { hasPermission } = useContext(PermissionContext);
  const location = useLocation();

  const visibleChildren = useMemo(
    () => group.children.filter((child) => isItemVisible(child, hasPermission)),
    [group.children, hasPermission],
  );

  // Expand at mount if the current route is inside this group, so a page refresh
  // on /news keeps Content open. Manual toggles after that are preserved.
  const [expanded, setExpanded] = useState(() => {
    if (group.defaultOpen) return true;
    return group.children.some((child) => location.pathname.startsWith(child.path));
  });

  if (visibleChildren.length === 0) return null;

  return (
    <div className="mt-3 first:mt-0">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-800 hover:bg-gray-100 transition-colors"
      >
        <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={group.icon} />
        </svg>
        <span className="flex-1 text-left whitespace-nowrap truncate">{group.label}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="mt-1 space-y-1">
          {visibleChildren.map((child) => (
            <MenuLink key={child.path} item={child} indented />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full overflow-y-auto px-4 py-6">
      <div className="mb-8 px-3">
        <h1 className="text-xl font-bold text-primary-800">BrightNow</h1>
        <p className="text-xs text-gray-500 mt-1">Admin Panel</p>
      </div>
      <nav className="space-y-1">
        {menuItems.map((item, index) =>
          item.type === 'group'
            ? <MenuGroup key={`group-${index}`} group={item} />
            : <TopLevelLink key={item.path} item={item} />,
        )}
      </nav>
    </aside>
  );
}
