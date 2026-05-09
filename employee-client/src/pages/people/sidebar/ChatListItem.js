import React from 'react';

function formatTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;
  const oneDay = 86400000;

  if (diff < oneDay && date.getDate() === now.getDate()) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (diff < 2 * oneDay) return 'Yesterday';
  if (diff < 7 * oneDay) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return `${f}${l}` || '?';
}

export default function ChatListItem({ conversation, active, onSelect, isOnline }) {
  const c = conversation;
  const other = c.otherUser;
  const name = other ? `${other.firstName || ''} ${other.lastName || ''}`.trim() : 'Unknown';
  const preview = c.lastMessage?.content || 'No messages yet';
  const time = formatTime(c.lastMessage?.createdAt);

  const avatarEl = other?.avatarUrl ? (
    <img
      className={`w-12 h-12 rounded-full object-cover ${active ? 'border-2 border-white shadow-sm' : 'border border-outline-variant'}`}
      alt={name}
      src={other.avatarUrl}
    />
  ) : (
    <div
      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-xs ${
        active
          ? 'bg-white/30 text-white border-2 border-white shadow-sm'
          : 'bg-primary-container/40 text-primary border border-outline-variant'
      }`}
    >
      {getInitials(other?.firstName, other?.lastName)}
    </div>
  );

  const baseClasses = active
    ? 'w-full p-unit-md flex gap-unit-sm items-start bg-primary-container text-on-primary-container transition-colors relative text-left'
    : 'w-full p-unit-md flex gap-unit-sm items-start hover:bg-surface-container-low transition-colors border-b border-gray-50 text-left';

  return (
    <button type="button" onClick={() => onSelect(c.id)} className={baseClasses}>
      {active && (
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" aria-hidden="true" />
      )}
      <div className="relative shrink-0">
        {avatarEl}
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 ${
            isOnline ? 'bg-green-500' : 'bg-gray-300'
          } border-2 border-white rounded-full`}
          aria-hidden="true"
        />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <span
            className={
              active
                ? 'font-h3 text-body-md font-semibold truncate'
                : 'font-body-md font-medium text-on-surface truncate'
            }
          >
            {name}
          </span>
          <span
            className={`text-[11px] shrink-0 ${active ? 'opacity-70' : 'text-outline'}`}
          >
            {time}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <p
            className={`text-body-sm truncate flex-grow ${
              active ? 'opacity-90' : 'text-outline'
            }`}
          >
            {preview}
          </p>
          {c.unreadCount > 0 && !active && (
            <span className="bg-primary text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shrink-0">
              {c.unreadCount > 9 ? '9+' : c.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
