import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import Avatar from '../common/Avatar';
import { useAuth } from '../../hooks/useAuth';

const NAV_ITEMS = [
  { to: '/home', label: 'Home' },
  { to: '/people', label: 'People' },
  { to: '/news', label: 'News' },
  { to: '/documents', label: 'Documents' },
  { to: '/policies', label: 'Policies' },
  { to: '/org-chart', label: 'Org Chart' },
];

const ACTIVE =
  'text-zinc-900 font-semibold border-b-2 border-primary-container pb-1 h-full flex items-center mt-0.5';
const INACTIVE =
  'text-zinc-500 font-medium hover:text-zinc-800 transition-all duration-200';

export default function TopNav() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    : '';

  return (
    <header className="bg-white border-b border-zinc-100 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 w-full">
        <div className="flex items-center gap-6 lg:gap-12 min-w-0">
          <NavLink
            to="/home"
            className="text-xl font-bold tracking-tight text-zinc-900 shrink-0"
          >
            BrightNOW
          </NavLink>
          <nav className="hidden md:flex gap-6 lg:gap-8 items-center h-full">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/home'}
                className={({ isActive }) => (isActive ? ACTIVE : INACTIVE)}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <div className="relative hidden lg:block">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
            />
            <input
              className="pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-lg text-sm w-48 xl:w-64 focus:ring-2 focus:ring-primary-container transition-all"
              placeholder="Search resources..."
              type="text"
            />
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-3 active:scale-95 transition-transform cursor-pointer"
            >
              <Avatar name={fullName} src={user?.avatar_url} size="sm" />
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl border border-zinc-100 shadow-lg overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-zinc-100">
                  <p className="text-sm font-semibold text-on-surface truncate">
                    {fullName}
                  </p>
                  <p className="text-xs text-on-surface-variant truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    logout();
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-zinc-50 transition-colors flex items-center gap-2"
                >
                  <MaterialIcon name="logout" className="text-[18px] text-zinc-500" />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
