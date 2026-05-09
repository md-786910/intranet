import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

function getInitials(firstName, lastName) {
  const f = (firstName || '').charAt(0).toUpperCase();
  const l = (lastName || '').charAt(0).toUpperCase();
  return `${f}${l}` || '?';
}

export default function ChatHeader({ contact, isOnline, onBack }) {
  if (!contact) return null;

  const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';

  return (
    <header className="px-unit-lg py-unit-md border-b border-outline-variant bg-white flex justify-between items-center z-10 shrink-0">
      <div className="flex items-center gap-unit-sm min-w-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden p-2 hover:bg-surface-container-low rounded-lg transition-colors text-outline -ml-1"
            aria-label="Back to messages"
          >
            <MaterialIcon name="arrow_back" />
          </button>
        )}
        {contact.avatarUrl ? (
          <img
            className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
            alt={name}
            src={contact.avatarUrl}
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center shrink-0 border border-outline-variant">
            <span className="text-primary text-xs font-bold">
              {getInitials(contact.firstName, contact.lastName)}
            </span>
          </div>
        )}
        <div className="min-w-0">
          <h3 className="font-h3 text-body-md font-bold text-on-surface truncate">
            {name}
          </h3>
          {isOnline ? (
            <p className="text-[12px] text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-600 rounded-full" aria-hidden="true" />
              Online
            </p>
          ) : (
            <p className="text-[12px] text-outline">Offline</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          className="p-2 hover:bg-surface-container-low rounded-lg transition-colors text-outline"
          aria-label="Video call"
        >
          <MaterialIcon name="videocam" />
        </button>
        <button
          type="button"
          className="p-2 hover:bg-surface-container-low rounded-lg transition-colors text-outline"
          aria-label="Voice call"
        >
          <MaterialIcon name="call" />
        </button>
        <span className="w-px h-6 bg-outline-variant mx-1" aria-hidden="true" />
        <button
          type="button"
          className="p-2 hover:bg-surface-container-low rounded-lg transition-colors text-outline"
          aria-label="More"
        >
          <MaterialIcon name="more_vert" />
        </button>
      </div>
    </header>
  );
}
