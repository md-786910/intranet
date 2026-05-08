import React from 'react';

export default function ChatListItem({ conversation, active, onSelect }) {
  const c = conversation;

  if (active) {
    return (
      <button
        type="button"
        onClick={() => onSelect(c.id)}
        className="w-full p-unit-md flex gap-unit-sm items-start bg-primary-container text-on-primary-container transition-colors relative text-left"
      >
        <span className="absolute left-0 top-0 bottom-0 w-1 bg-primary" aria-hidden="true" />
        <div className="relative shrink-0">
          <img
            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            alt={c.name}
            src={c.avatarUrl}
          />
          <span
            className={`absolute bottom-0 right-0 w-3 h-3 ${
              c.online ? 'bg-green-500' : 'bg-gray-300'
            } border-2 border-white rounded-full`}
            aria-hidden="true"
          />
        </div>
        <div className="flex-grow min-w-0">
          <div className="flex justify-between items-baseline gap-2">
            <span className="font-h3 text-body-md font-semibold truncate">{c.name}</span>
            <span className="text-[11px] opacity-70 shrink-0">{c.lastMessageAt}</span>
          </div>
          <p className="text-body-sm opacity-90 truncate">{c.preview}</p>
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onSelect(c.id)}
      className="w-full p-unit-md flex gap-unit-sm items-start hover:bg-surface-container-low transition-colors border-b border-gray-50 text-left"
    >
      <div className="relative shrink-0">
        <img
          className="w-12 h-12 rounded-full object-cover border border-outline-variant"
          alt={c.name}
          src={c.avatarUrl}
        />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 ${
            c.online ? 'bg-green-500' : 'bg-gray-300'
          } border-2 border-white rounded-full`}
          aria-hidden="true"
        />
      </div>
      <div className="flex-grow min-w-0">
        <div className="flex justify-between items-baseline gap-2">
          <span className="font-body-md font-medium text-on-surface truncate">{c.name}</span>
          <span className="text-[11px] text-outline shrink-0">{c.lastMessageAt}</span>
        </div>
        <p className="text-body-sm text-outline truncate">{c.preview}</p>
      </div>
    </button>
  );
}
