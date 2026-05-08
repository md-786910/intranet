import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import ChatListItem from './ChatListItem';

export default function MessagesSidebar({
  conversations,
  selectedId,
  onSelect,
  className = '',
}) {
  return (
    <aside
      className={`flex flex-col bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden h-full ${className}`}
    >
      <div className="p-unit-md border-b border-outline-variant bg-surface flex justify-between items-center shrink-0">
        <h2 className="font-h2 text-h2 text-on-surface">Messages</h2>
        <button
          type="button"
          className="p-unit-xs hover:bg-surface-variant rounded-lg transition-colors"
          aria-label="New message"
        >
          <MaterialIcon name="edit_square" className="text-primary" />
        </button>
      </div>

      <div className="p-unit-md shrink-0">
        <div className="relative">
          <MaterialIcon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm"
          />
          <input
            type="text"
            placeholder="Search chats..."
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-grow overflow-y-auto chat-scrollbar min-h-0">
        {conversations.map((c) => (
          <ChatListItem
            key={c.id}
            conversation={c}
            active={c.id === selectedId}
            onSelect={onSelect}
          />
        ))}
      </div>
    </aside>
  );
}
