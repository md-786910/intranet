import React from 'react';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

const KIND_STYLES = {
  created:     { label: 'Created',     dot: 'bg-blue-500',    ring: 'bg-blue-50' },
  updated:     { label: 'Updated',     dot: 'bg-gray-400',    ring: 'bg-gray-100' },
  published:   { label: 'Published',   dot: 'bg-emerald-500', ring: 'bg-emerald-50' },
  unpublished: { label: 'Unpublished', dot: 'bg-amber-500',   ring: 'bg-amber-50' },
  archived:    { label: 'Archived',    dot: 'bg-orange-500',  ring: 'bg-orange-50' },
  uploaded:    { label: 'Uploaded',    dot: 'bg-indigo-500',  ring: 'bg-indigo-50' },
  deleted:     { label: 'Deleted',     dot: 'bg-red-500',     ring: 'bg-red-50' },
};

// Inline SVG paths (Heroicons-style, 24x24 viewBox). White stroke; rendered
// inside a coloured dot so they read clearly at small sizes.
const KIND_ICONS = {
  // plus
  created: 'M12 4.5v15m7.5-7.5h-15',
  uploaded: 'M12 4.5v15m7.5-7.5h-15',
  // pencil
  updated: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zM19.5 7.125L16.875 4.5',
  // paper-plane
  published: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  // eye-slash
  unpublished: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  // archive-box
  archived: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  // trash
  deleted: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
};

function initialsOf(user) {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length === 0) return (user.email || '?').slice(0, 2).toUpperCase();
  return parts.map((p) => p.charAt(0).toUpperCase()).join('').slice(0, 2);
}

function nameOf(user) {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email || null;
}

function Avatar({ user }) {
  if (!user) {
    return (
      <span className="inline-flex w-7 h-7 rounded-full bg-gray-100 text-gray-400 items-center justify-center text-[10px] font-semibold">
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-7 h-7 rounded-full bg-primary-100 text-primary-700 items-center justify-center text-[11px] font-semibold"
      title={nameOf(user)}
    >
      {initialsOf(user)}
    </span>
  );
}

function ActivityEvent({ event }) {
  const style = KIND_STYLES[event.kind] || KIND_STYLES.updated;
  const iconPath = KIND_ICONS[event.kind] || KIND_ICONS.updated;
  const absolute = formatDateTime(event.at);
  const relative = formatRelativeTime(event.at);
  return (
    <li className="relative pl-10 pb-5 last:pb-0">
      <span
        className={`absolute left-0 top-0.5 inline-flex w-6 h-6 rounded-full ${style.dot} items-center justify-center ring-4 ${style.ring}`}
        title={absolute}
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </span>
      <div className="flex items-start gap-2">
        <span className="text-sm font-semibold text-gray-900">{style.label}</span>
      </div>
      <div className="mt-1 flex items-center gap-2">
        <Avatar user={event.actor} />
        <span className="text-sm text-gray-700 truncate">{nameOf(event.actor) || <span className="text-gray-400">Unknown</span>}</span>
      </div>
      <div className="mt-0.5 text-xs text-gray-500 pl-9">
        {relative} <span className="text-gray-300 mx-1">·</span> {absolute}
      </div>
    </li>
  );
}

/**
 * Vertical activity timeline. `events` is an array of
 * `{ kind, actor, at }` rendered top-to-bottom (callers decide order —
 * detail pages pass newest-first).
 *
 * Caps height at ~6 events worth so a busy entity (10+ events) scrolls
 * inside the panel instead of pushing the rest of the detail page down.
 * Pass `scrollable={false}` (e.g. inside a modal that already scrolls) to
 * let the timeline grow naturally.
 */
export default function ActivityTimeline({ events, scrollable = true }) {
  if (!Array.isArray(events) || events.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-6 text-center text-sm text-gray-500">
        No activity yet.
      </div>
    );
  }
  const scrollClass = scrollable ? 'max-h-[28rem] overflow-y-auto pr-2' : '';
  return (
    <div className={scrollClass}>
      <ol className="relative ml-3 border-l-2 border-gray-200 pl-0">
        {events.map((ev, i) => (
          <ActivityEvent key={`${ev.kind}-${ev.at}-${i}`} event={ev} />
        ))}
      </ol>
    </div>
  );
}
