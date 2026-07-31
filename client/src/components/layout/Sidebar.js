import React, { useContext, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { PermissionContext } from '../../contexts/PermissionContext';
import { useAuth } from '../../hooks/useAuth';
import { useAppBranding } from '../../contexts/AppBrandingContext';

const SCOPE_RANK = { DEPARTMENT: 4, VERTICAL: 3, OFFICE_LOCATION: 2, COMPANY: 2, ORGANISATION: 1, GROUP: 1 };

const ICONS = {
  dashboard: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  organisation: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  activeDirectory: 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
  users: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  roles: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z',
  news: 'M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z',
  documents: 'M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z',
  media: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
  employees: 'M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 014-4h1m4 0a4 4 0 100-8 4 4 0 000 8zm6-2a4 4 0 11-8 0 4 4 0 018 0zM9 7a3 3 0 11-6 0 3 3 0 016 0z',
  categories: 'M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z M6 6h.008v.008H6V6z',
  settings: 'M21.75 6.75a4.5 4.5 0 01-4.884 4.484c-1.076-.091-2.264.071-2.95.904l-7.152 8.684a2.548 2.548 0 11-3.586-3.586l8.684-7.152c.833-.686.995-1.874.904-2.95a4.5 4.5 0 016.336-4.486l-3.276 3.276a3.004 3.004 0 002.25 2.25l3.276-3.276c.256.565.398 1.192.398 1.852z',
  analytics: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  activity: 'M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z',
  chat: 'M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155',
  logout: 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9',
};

const menuItems = [
  { type: 'link', label: 'Dashboard', path: '/dashboard', icon: ICONS.dashboard, module: 'ADMIN', action: 'VIEW_ANALYTICS' },
  {
    type: 'link',
    label: 'Dashboard',
    path: '/content-dashboard',
    icon: ICONS.dashboard,
    hideWhen: { module: 'ADMIN', action: 'VIEW_ANALYTICS' },
    anyOf: [
      { module: 'NEWS', action: 'VIEW' },
      { module: 'DOCUMENTS', action: 'VIEW' },
    ],
  },
  // Visible to all portal users (incl. Content Editors) — uses /chat/contacts, not Users admin.
  { type: 'link', label: 'Chat', path: '/chat', icon: ICONS.chat, alwaysShow: true },
  {
    type: 'group',
    label: 'Organisation',
    icon: ICONS.organisation,
    defaultOpen: false,
    children: [
      { label: 'Organisation Tree', path: '/organisation', icon: ICONS.organisation, module: 'ADMIN', action: 'MANAGE_OFFICE_LOCATIONS' },
      { label: 'Active Directory', path: '/active-directory', icon: ICONS.activeDirectory, module: 'ADMIN', action: 'MANAGE_USERS' },
    ],
  },
  {
    type: 'group',
    label: 'User Management',
    icon: ICONS.users,
    defaultOpen: false,
    children: [
      { label: 'Users', path: '/users', icon: ICONS.users, module: 'ADMIN', action: 'MANAGE_USERS' },
      { label: 'Role Permission', path: '/roles', icon: ICONS.roles, module: 'ADMIN', action: 'MANAGE_ROLES' },
      { label: 'Job Titles', path: '/job-titles', icon: ICONS.categories, module: 'ADMIN', action: 'MANAGE_EMPLOYEES' },
    ],
  },
  {
    type: 'group',
    label: 'Content',
    icon: ICONS.news,
    defaultOpen: true,
    children: [
      { label: 'News', path: '/news', icon: ICONS.news, module: 'NEWS', action: 'VIEW' },
      { label: 'Announcements', path: '/announcements', icon: ICONS.news, module: 'NEWS', action: 'VIEW' },
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
      {
        label: 'Activity log',
        path: '/activity',
        icon: ICONS.activity,
        anyOf: [
          { module: 'NEWS', action: 'EDIT' },
          { module: 'DOCUMENTS', action: 'EDIT' },
          { module: 'NEWS', action: 'CREATE' },
          { module: 'DOCUMENTS', action: 'CREATE' },
        ],
      },
    ],
  },
  {
    type: 'group',
    label: 'Settings',
    icon: ICONS.settings,
    defaultOpen: false,
    children: [
      { label: 'Quick Links', path: '/quick-links', icon: ICONS.categories, module: 'ADMIN', action: 'MANAGE_EMPLOYEES' },
      { label: 'Configuration', path: '/settings', icon: ICONS.settings, module: 'ADMIN', action: 'MANAGE_USERS' },
    ],
  },
];

function MenuLink({ item, indented = false }) {
  return (
    <NavLink
      to={item.path}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
          indented ? 'pl-9 pr-3 py-2' : 'px-3 py-2'
        } ${
          isActive
            ? 'bg-primary-50 text-primary-700 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[3px] before:rounded-full before:bg-primary-600'
            : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }`
      }
    >
      <svg className="w-5 h-5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
      </svg>
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function isItemVisible(item, hasPermission, isOwner) {
  if (item.alwaysShow) return true;
  if (item.ownerOnly) return Boolean(isOwner);
  if (item.hideWhen && hasPermission(item.hideWhen.module, item.hideWhen.action)) return false;
  if (Array.isArray(item.anyOf) && item.anyOf.length > 0) {
    return item.anyOf.some((p) => hasPermission(p.module, p.action));
  }
  return hasPermission(item.module, item.action);
}

function TopLevelLink({ item }) {
  const { hasPermission } = useContext(PermissionContext);
  const { isOwner } = useAuth();
  if (!isItemVisible(item, hasPermission, isOwner)) return null;
  return <MenuLink item={item} />;
}

function MenuGroup({ group }) {
  const { hasPermission } = useContext(PermissionContext);
  const { isOwner } = useAuth();
  const location = useLocation();

  const visibleChildren = useMemo(
    () => group.children.filter((child) => isItemVisible(child, hasPermission, isOwner)),
    [group.children, hasPermission, isOwner],
  );

  const [expanded, setExpanded] = useState(() => {
    if (group.defaultOpen) return true;
    return group.children.some((child) => location.pathname.startsWith(child.path));
  });

  if (visibleChildren.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <svg className="w-5 h-5 flex-shrink-0 opacity-80" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
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
        <div className="mt-0.5 space-y-0.5">
          {visibleChildren.map((child) => (
            <MenuLink key={child.path} item={child} indented />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Sidebar() {
  const { user, logout, isOwner, roleAssignments } = useAuth();
  const { applicationName } = useAppBranding();

  const roleLabel = useMemo(() => {
    if (isOwner) return 'Owner';
    const orgWide = (roleAssignments || []).find(
      (a) => a.scope_type === 'GROUP' || a.scope_type === 'ORGANISATION',
    );
    if (orgWide?.role?.name) return orgWide.role.name;
    const ranked = [...(roleAssignments || [])].sort(
      (a, b) => (SCOPE_RANK[b.scope_type] || 0) - (SCOPE_RANK[a.scope_type] || 0),
    );
    return ranked[0]?.role?.name || 'Admin';
  }, [isOwner, roleAssignments]);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-full flex flex-col">
      <div className="px-4 pt-5 pb-4 flex-shrink-0">
        <h1 className="text-xl font-semibold tracking-tight text-primary-800 truncate" title={applicationName}>
          {applicationName}
        </h1>
        <p className="text-xs font-bold text-primary-700 mt-1">{roleLabel}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {menuItems.map((item, index) =>
          item.type === 'group'
            ? <MenuGroup key={`group-${index}`} group={item} />
            : <TopLevelLink key={item.path} item={item} />,
        )}
      </nav>

      <div className="flex-shrink-0 border-t border-gray-100 p-4 space-y-2.5">
        <div className="px-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {[user?.first_name, user?.last_name].filter(Boolean).join(' ') || 'User'}
          </p>
          <p className="text-xs text-gray-400 truncate">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50 hover:text-gray-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d={ICONS.logout} />
          </svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
