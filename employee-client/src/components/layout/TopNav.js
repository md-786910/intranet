import React, { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import MaterialIcon from "../common/MaterialIcon";
import Avatar from "../common/Avatar";
import SearchModal from "../search/SearchModal";
import { useAuth } from "../../hooks/useAuth";
import { useNotifications } from "../../hooks/useNotifications";
import { useChatUnread } from "../../contexts/ChatUnreadContext";
import { deeplinkFor } from "../../utils/notificationDeeplink";
import { formatRelative } from "../../theme/dateFormat";

// Visual mapping for notification rows in the bell dropdown. Each type gets a
// distinct icon, chip background, chip text colour, and a short label so the
// user can scan news vs documents at a glance.
const NOTIFICATION_TYPE_STYLES = {
  NEWS: {
    icon: "campaign",
    iconBg: "bg-blue-50",
    iconColor: "text-blue-600",
    tagBg: "bg-blue-100",
    tagText: "text-blue-700",
    label: "News",
  },
  DOCUMENT: {
    icon: "description",
    iconBg: "bg-amber-50",
    iconColor: "text-amber-700",
    tagBg: "bg-amber-100",
    tagText: "text-amber-800",
    label: "Document",
  },
};
const DEFAULT_TYPE_STYLE = {
  icon: "notifications",
  iconBg: "bg-zinc-50",
  iconColor: "text-zinc-600",
  tagBg: "bg-zinc-100",
  tagText: "text-zinc-700",
  label: "Update",
};

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
  const [searchOpen, setSearchOpen] = useState(false);
  const menuRef = useRef(null);
  const notificationsRef = useRef(null);

  // Global ⌘K / Ctrl+K shortcut to summon the search modal from anywhere.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const {
    items: notifications,
    unreadCount,
    loading: notificationsLoading,
    markRead,
    markAllRead,
    refresh: refreshNotifications,
  } = useNotifications();
  const { totalUnread: chatUnread } = useChatUnread();

  const onNotificationClick = (notification) => {
    setNotificationsOpen(false);
    if (!notification.read_at) markRead(notification.notification_id);
    navigate(deeplinkFor(notification));
  };

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
                <span className="inline-flex items-center gap-1.5">
                  {item.label}
                  {item.to === "/people" && chatUnread > 0 && (
                    <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold leading-5 text-center">
                      {chatUnread > 9 ? "9+" : chatUnread}
                    </span>
                  )}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3 sm:gap-6 shrink-0">
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden lg:flex items-center gap-2 pl-3 pr-2 py-2 bg-surface-container-low border-none rounded-lg text-sm w-48 xl:w-64 text-outline hover:bg-surface-container-low/80 focus:ring-2 focus:ring-primary-container transition-all"
          >
            <MaterialIcon name="search" className="text-outline text-[20px]" />
            <span className="flex-1 text-left">Search resources...</span>
            <kbd className="ml-auto text-[10px] font-semibold tracking-wide bg-white border border-zinc-200 rounded px-1.5 py-0.5 text-zinc-500">⌘K</kbd>
          </button>
          <div className="relative flex items-center gap-2 sm:gap-4">
            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen((v) => {
                  // Pull fresh state from the server whenever the user opens
                  // the bell — covers the case where socket events arrived
                  // mid-session and we want absolute consistency.
                  if (!v) refreshNotifications();
                  return !v;
                })}
                className="w-10 h-10 rounded-full flex items-center justify-center text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800 transition-all active:scale-90 relative"
                aria-label="Notifications"
              >
                <MaterialIcon name="notifications" className="text-[24px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-3 w-80 sm:w-96 bg-white rounded-2xl border border-zinc-100 shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-5 py-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50/50">
                    <h3 className="font-bold text-zinc-900">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="text-xs font-semibold text-primary px-2 py-0.5 bg-primary-container/20 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount} New
                      </span>
                    )}
                  </div>
                  <div className="max-h-[400px] overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="px-5 py-8 text-center text-sm text-zinc-500">
                        Loading…
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-5 py-10 text-center">
                        <MaterialIcon
                          name="notifications_none"
                          className="text-zinc-300"
                          style={{ fontSize: 40 }}
                        />
                        <p className="text-sm text-zinc-500 mt-2">
                          No notifications yet.
                        </p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const style =
                          NOTIFICATION_TYPE_STYLES[n.type] || DEFAULT_TYPE_STYLE;
                        const isUnread = !n.read_at;
                        return (
                          <button
                            key={n.notification_id}
                            type="button"
                            onClick={() => onNotificationClick(n)}
                            className={`w-full text-left px-4 py-3 border-b border-zinc-50 hover:bg-zinc-50/70 transition-colors cursor-pointer group relative ${
                              isUnread ? 'bg-primary-container/10' : ''
                            }`}
                          >
                            {/* Left accent strip — colored when unread to draw the eye */}
                            {isUnread && (
                              <span
                                className={`absolute left-0 top-3 bottom-3 w-1 rounded-r-full ${
                                  n.type === 'DOCUMENT' ? 'bg-amber-500' : 'bg-blue-500'
                                }`}
                                aria-hidden
                              />
                            )}
                            <div className="flex gap-3">
                              <div
                                className={`w-10 h-10 rounded-xl ${style.iconBg} flex items-center justify-center shrink-0`}
                              >
                                <MaterialIcon
                                  name={style.icon}
                                  className={`${style.iconColor} text-[20px]`}
                                  style={{ fontVariationSettings: '"FILL" 1' }}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${style.tagBg} ${style.tagText}`}
                                  >
                                    {style.label}
                                  </span>
                                  <span
                                    className="text-[10px] text-zinc-400 font-medium"
                                    title={new Date(n.created_at).toLocaleString()}
                                  >
                                    {formatRelative(n.created_at)}
                                  </span>
                                </div>
                                <p
                                  className={`text-sm leading-snug line-clamp-1 ${
                                    isUnread
                                      ? 'font-semibold text-zinc-900'
                                      : 'font-medium text-zinc-700'
                                  }`}
                                >
                                  {n.title}
                                </p>
                                {n.body && (
                                  <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">
                                    {n.body}
                                  </p>
                                )}
                              </div>
                              {isUnread && (
                                <span className="w-2 h-2 mt-1.5 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="w-full py-3 text-sm font-bold text-zinc-600 hover:text-primary hover:bg-zinc-50 transition-all border-t border-zinc-100"
                    >
                      Mark all as read
                    </button>
                  )}
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
                      navigate("/announcements");
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm font-medium text-on-surface hover:bg-zinc-50 transition-colors flex items-center gap-2"
                  >
                    <MaterialIcon
                      name="campaign"
                      className="text-[18px] text-zinc-500"
                    />
                    Announcements
                  </button>
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
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
    </header>
  );
}
