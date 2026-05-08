import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function ChatHeader({ contact, onBack }) {
  if (!contact) return null;
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
        <img
          className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
          alt={contact.name}
          src={contact.avatarUrl}
        />
        <div className="min-w-0">
          <h3 className="font-h3 text-body-md font-bold text-on-surface truncate">
            {contact.name}
          </h3>
          {contact.online ? (
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
