import React, { useState, useCallback, useEffect, useRef } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import ChatListItem from './ChatListItem';
import { chatService } from '../../../services/chatService';
import Skeleton from '../../../components/common/Skeleton';

export default function MessagesSidebar({
  conversations,
  selectedId,
  onSelect,
  onNewConversation,
  onlineUsers,
  loading,
  error,
  className = '',
}) {
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const modalRef = useRef(null);

  // Filter conversations by search
  const filtered = search.trim()
    ? conversations.filter((c) => {
        const name = `${c.otherUser?.firstName || ''} ${c.otherUser?.lastName || ''}`.toLowerCase();
        return name.includes(search.toLowerCase());
      })
    : conversations;

  // Load contacts for "New Chat" modal
  const loadContacts = useCallback(async (searchTerm) => {
    setContactsLoading(true);
    try {
      const res = await chatService.getContacts({
        search: searchTerm || undefined,
        limit: 50,
      });
      setContacts(res.data?.data || []);
    } catch {
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showNewChat) {
      loadContacts(contactSearch);
    }
  }, [showNewChat, contactSearch, loadContacts]);

  // Close modal on outside click
  useEffect(() => {
    if (!showNewChat) return;
    const handler = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        setShowNewChat(false);
        setContactSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewChat]);

  const handleContactSelect = async (contact) => {
    try {
      const res = await chatService.createConversation(contact.userId);
      const conv = res.data?.data;
      if (conv) {
        onNewConversation(conv);
      }
    } catch {
      // Could show toast here
    }
    setShowNewChat(false);
    setContactSearch('');
  };

  return (
    <aside
      className={`flex flex-col bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden h-full relative ${className}`}
    >
      <div className="p-unit-md border-b border-outline-variant bg-surface flex justify-between items-center shrink-0">
        <h2 className="font-h2 text-h2 text-on-surface">Messages</h2>
        <button
          type="button"
          className="p-unit-xs hover:bg-surface-variant rounded-lg transition-colors"
          aria-label="New message"
          onClick={() => setShowNewChat(true)}
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
          />
        </div>
      </div>

      <div className="flex-grow overflow-y-auto chat-scrollbar min-h-0">
        {loading ? (
          <div className="p-unit-md space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
        ) : error ? (
          <div className="p-6 text-center">
            <MaterialIcon name="error_outline" className="text-3xl text-red-400 mb-2" />
            <p className="text-body-sm text-on-surface-variant">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center">
            <MaterialIcon name="chat_bubble_outline" className="text-3xl text-outline mb-2" />
            <p className="text-body-sm text-on-surface-variant">
              {search ? 'No matching conversations' : 'No conversations yet'}
            </p>
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="mt-3 px-4 py-2 bg-primary-container text-on-background rounded-lg text-xs font-bold hover:bg-primary-container/80 transition-all"
            >
              Start a chat
            </button>
          </div>
        ) : (
          filtered.map((c) => (
            <ChatListItem
              key={c.id}
              conversation={c}
              active={c.id === selectedId}
              onSelect={onSelect}
              isOnline={onlineUsers?.has(c.otherUser?.userId)}
            />
          ))
        )}
      </div>

      {/* New Chat Modal */}
      {showNewChat && (
        <div className="absolute inset-0 z-20 bg-white flex flex-col" ref={modalRef}>
          <div className="p-unit-md border-b border-outline-variant flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => { setShowNewChat(false); setContactSearch(''); }}
              className="p-1 hover:bg-surface-container-low rounded-lg transition-colors"
            >
              <MaterialIcon name="arrow_back" className="text-on-surface" />
            </button>
            <h3 className="font-h3 text-body-md font-bold text-on-surface">New Conversation</h3>
          </div>
          <div className="p-unit-md shrink-0">
            <div className="relative">
              <MaterialIcon
                name="search"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm"
              />
              <input
                type="text"
                placeholder="Search colleagues..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-lg font-body-sm focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all"
                autoFocus
              />
            </div>
          </div>
          <div className="flex-grow overflow-y-auto chat-scrollbar min-h-0">
            {contactsLoading ? (
              <div className="p-unit-md space-y-3">
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
                <Skeleton className="h-14 rounded-xl" />
              </div>
            ) : contacts.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-body-sm text-on-surface-variant">
                  {contactSearch ? 'No colleagues found' : 'No colleagues in your vertical'}
                </p>
              </div>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.userId}
                  type="button"
                  onClick={() => handleContactSelect(contact)}
                  className="w-full p-unit-md flex gap-unit-sm items-center hover:bg-surface-container-low transition-colors border-b border-gray-50 text-left"
                >
                  {contact.avatarUrl ? (
                    <img
                      className="w-10 h-10 rounded-full object-cover border border-outline-variant shrink-0"
                      alt={`${contact.firstName} ${contact.lastName}`}
                      src={contact.avatarUrl}
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary-container/40 flex items-center justify-center shrink-0">
                      <span className="text-primary text-xs font-bold">
                        {(contact.firstName?.[0] || '').toUpperCase()}
                        {(contact.lastName?.[0] || '').toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="min-w-0 flex-grow">
                    <p className="font-semibold text-body-sm text-on-surface truncate">
                      {contact.firstName} {contact.lastName}
                    </p>
                    <p className="text-[11px] text-on-surface-variant truncate">
                      {contact.jobTitle || contact.departmentName || contact.email}
                    </p>
                  </div>
                  {onlineUsers?.has(contact.userId) && (
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full shrink-0" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
