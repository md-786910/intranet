import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import MaterialIcon from "../common/MaterialIcon";
import Avatar from "../common/Avatar";
import { useAuth } from "../../hooks/useAuth";

const NAV_ITEMS = [
  { to: "/home", label: "Home" },
  { to: "/people", label: "People" },
  { to: "/news", label: "News" },
  { to: "/documents", label: "Documents" },
  // { to: '/policies', label: 'Policies' },
  { to: "/org-chart", label: "Org Chart" },
];

const ACTIVE =
  "text-zinc-900 font-semibold border-b-2 border-primary-container pb-1 h-full flex items-center mt-0.5";
const INACTIVE =
  "text-zinc-500 font-medium hover:text-zinc-800 transition-all duration-200";

export default function TopNav() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);

  useEffect(() => {
    if (!open && !notificationsOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setOpen(false);
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(e.target)
      )
        setNotificationsOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, notificationsOpen]);

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(" ") || user.email
    : "";

  return (
    <header className="bg-white border-b border-zinc-100 shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16 w-full max-w-screen-2xl mx-auto">
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
                end={item.to === "/home"}
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
          <div className="relative flex items-center gap-2 sm:gap-4">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => !v)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-all active:scale-90 relative"
              >
                <MaterialIcon name="notifications" className="text-[24px]" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl border border-zinc-100 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h3 className="font-bold text-zinc-900">Notifications</h3>
                    <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary-container/20 rounded-full">
                      2 New
                    </span>
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    <div className="p-4 border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer group">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 group-hover:bg-blue-100 transition-colors">
                          <MaterialIcon
                            name="article"
                            className="text-blue-600 text-[20px]"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">
                            New Policy Update
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                            The Hybrid Work Policy has been updated for Q3.
                            Please review the changes.
                          </p>
                          <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            2 hours ago
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="p-4 border-b border-zinc-50 hover:bg-zinc-50/50 transition-colors cursor-pointer group">
                      <div className="flex gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                          <MaterialIcon
                            name="celebration"
                            className="text-green-600 text-[20px]"
                          />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-zinc-900 leading-snug">
                            Happy Birthday!
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                            Join us in wishing Sarah a very happy birthday
                            today!
                          </p>
                          <span className="text-[10px] text-zinc-400 font-medium mt-1 block">
                            5 hours ago
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate("/settings", {
                        state: { activeTab: "notifications" },
                      });
                    }}
                    className="w-full py-3 text-sm font-bold text-zinc-600 hover:text-primary hover:bg-zinc-50 transition-all border-t border-zinc-100"
                  >
                    View All Notifications
                  </button>
                </div>
              )}
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
                      navigate("/settings");
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-zinc-50 transition-colors flex items-center gap-2"
                  >
                    <MaterialIcon
                      name="settings"
                      className="text-[18px] text-zinc-500"
                    />
                    Settings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-zinc-50 transition-colors flex items-center gap-2 border-t border-zinc-100"
                  >
                    <MaterialIcon
                      name="logout"
                      className="text-[18px] text-zinc-500"
                    />
                    Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
