import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { useChatUnread } from '../../contexts/ChatUnreadContext';
import { chatService } from '../../services/chatService';
import ChatConversationPane from './ChatConversationPane';

function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function initialsFromName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return parts.slice(0, 2).map((p) => p[0]).join('').toUpperCase();
}

function formatPreviewTime(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor((today - target) / 86400000);
  if (diffDays === 0) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }
  if (diffDays === 1) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function ChatPage() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  // Admin ChatUnreadContext exposes totalUnread + refresh helpers only
  // (no per-conversation map like the employee portal).
  const {
    setActiveConversationId,
    markConversationRead,
    refresh: refreshUnreadTotal,
  } = useChatUnread();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [listSearch, setListSearch] = useState('');
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  const [showNewChat, setShowNewChat] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [contactSearch, setContactSearch] = useState('');
  const [contactsLoading, setContactsLoading] = useState(false);
  const newChatRef = useRef(null);

  const myUserId = user?.user_id != null ? Number(user.user_id) : null;
  const myInitials = useMemo(
    () => initialsFromName([user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email),
    [user],
  );

  // Unread counts come from the conversations API payload.
  const displayConversations = conversations;

  const filteredConversations = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    if (!q) return displayConversations;
    return displayConversations.filter((c) => {
      const name = `${c.otherUser?.firstName || ''} ${c.otherUser?.lastName || ''}`.toLowerCase();
      return name.includes(q);
    });
  }, [displayConversations, listSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    chatService
      .getConversations()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || [];
        setConversations(data);
        refreshUnreadTotal?.();
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.message || 'Failed to load conversations');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setActiveConversationId(selectedId);
    return () => setActiveConversationId(null);
  }, [selectedId, setActiveConversationId]);

  // Deep-link ?userId= via chat contacts create — not admin Users API
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (!targetUserId || loading) return;
    const numId = parseInt(targetUserId, 10);
    if (!numId) return;

    const existing = conversations.find((c) => Number(c.otherUser?.userId) === numId);
    if (existing) {
      setSelectedId(existing.id);
      setMobileShowConversation(true);
      setSearchParams({}, { replace: true });
      return;
    }

    chatService
      .createConversation(numId)
      .then((res) => {
        const conv = res.data?.data;
        if (conv) {
          setConversations((prev) => (prev.find((c) => c.id === conv.id) ? prev : [conv, ...prev]));
          setSelectedId(conv.id);
          setMobileShowConversation(true);
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => setSearchParams({}, { replace: true }));
  }, [searchParams, loading, conversations, setSearchParams]);

  useEffect(() => {
    if (!socket) return undefined;

    const handleReceive = ({ conversationId, message }) => {
      if (!message) return;
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId);
        if (exists) {
          return prev
            .map((c) => {
              if (c.id !== conversationId) return c;
              const isActive = selectedId != null && String(c.id) === String(selectedId);
              const fromOther = myUserId != null && Number(message.senderId) !== myUserId;
              return {
                ...c,
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  senderId: message.senderId,
                  createdAt: message.createdAt,
                },
                updatedAt: message.createdAt,
                unreadCount: isActive || !fromOther
                  ? 0
                  : (Number(c.unreadCount) || 0) + 1,
              };
            })
            .sort((a, b) => {
              if (!a.updatedAt && !b.updatedAt) return 0;
              if (!a.updatedAt) return 1;
              if (!b.updatedAt) return -1;
              return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
        }
        chatService.getConversations().then((res) => {
          setConversations(res.data?.data || []);
          refreshUnreadTotal?.();
        });
        return prev;
      });
    };

    const handleEdited = ({ conversationId, message }) => {
      if (!message) return;
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== conversationId) return c;
          if (c.lastMessage?.id !== message.id) return c;
          return { ...c, lastMessage: { ...c.lastMessage, content: message.content } };
        }),
      );
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:edited', handleEdited);
    return () => {
      socket.off('chat:receive', handleReceive);
      socket.off('chat:edited', handleEdited);
    };
  }, [socket, selectedId, myUserId, refreshUnreadTotal]);

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
    if (!showNewChat) return undefined;
    const t = setTimeout(() => loadContacts(contactSearch), 200);
    return () => clearTimeout(t);
  }, [showNewChat, contactSearch, loadContacts]);

  useEffect(() => {
    if (!showNewChat) return undefined;
    const handler = (e) => {
      if (newChatRef.current && !newChatRef.current.contains(e.target)) {
        setShowNewChat(false);
        setContactSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showNewChat]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setMobileShowConversation(true);
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
    markConversationRead(id);
  }, [markConversationRead]);

  const handleNewConversation = useCallback((conv) => {
    setConversations((prev) => (prev.find((c) => c.id === conv.id) ? prev : [conv, ...prev]));
    setSelectedId(conv.id);
    setMobileShowConversation(true);
  }, []);

  const handleContactSelect = async (contact) => {
    try {
      const res = await chatService.createConversation(contact.userId);
      const conv = res.data?.data;
      if (conv) handleNewConversation(conv);
    } catch {
      /* ignore */
    }
    setShowNewChat(false);
    setContactSearch('');
  };

  const selected = displayConversations.find((c) => c.id === selectedId) || null;

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)] min-h-[28rem] -mx-1">
      <div className="mb-3 shrink-0">
        <h1 className="text-xl font-semibold text-gray-900">Chat</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Message colleagues. Start new chats from your contacts — no admin user list required.
        </p>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* Conversation list */}
        <aside
          className={`${
            mobileShowConversation ? 'hidden lg:flex' : 'flex'
          } w-full lg:w-80 shrink-0 flex-col bg-white border border-gray-200 rounded-xl overflow-hidden relative`}
        >
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
            <h2 className="text-sm font-semibold text-gray-900">Messages</h2>
            <button
              type="button"
              onClick={() => setShowNewChat(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
              New
            </button>
          </div>

          <div className="p-3 border-b border-gray-100 shrink-0">
            <input
              type="search"
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search chats…"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
            />
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="p-4 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-gray-100 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : error ? (
              <p className="p-4 text-sm text-red-600">{error}</p>
            ) : filteredConversations.length === 0 ? (
              <div className="p-6 text-center">
                <p className="text-sm font-medium text-gray-700">No conversations yet</p>
                <p className="text-xs text-gray-500 mt-1">Use New to find a contact and start chatting.</p>
              </div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {filteredConversations.map((c) => {
                  const name = [c.otherUser?.firstName, c.otherUser?.lastName].filter(Boolean).join(' ') || 'User';
                  const avatar = mediaUrl(c.otherUser?.avatarUrl);
                  const unread = c.unreadCount || 0;
                  const active = c.id === selectedId;
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(c.id)}
                        className={`w-full flex items-start gap-3 px-3 py-3 text-left transition-colors ${
                          active ? 'bg-primary-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="relative shrink-0">
                          {avatar ? (
                            <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-bold">
                              {initialsFromName(name)}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${unread ? 'font-semibold text-gray-900' : 'font-medium text-gray-800'}`}>
                              {name}
                            </span>
                            <span className="text-[10px] text-gray-400 shrink-0">
                              {formatPreviewTime(c.lastMessage?.createdAt || c.updatedAt)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <p className="text-xs text-gray-500 truncate">
                              {c.lastMessage?.content || 'No messages yet'}
                            </p>
                            {unread > 0 && (
                              <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary-600 text-white text-[10px] font-bold leading-5 text-center">
                                {unread > 9 ? '9+' : unread}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {showNewChat && (
            <div className="absolute inset-0 z-10 bg-white flex flex-col rounded-xl">
              <div ref={newChatRef} className="flex flex-col h-full">
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-900">New chat</h3>
                  <button
                    type="button"
                    onClick={() => { setShowNewChat(false); setContactSearch(''); }}
                    className="text-xs text-gray-500 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                </div>
                <div className="p-3 border-b border-gray-100">
                  <input
                    type="search"
                    autoFocus
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    placeholder="Search contacts…"
                    className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  />
                </div>
                <div className="flex-1 overflow-y-auto min-h-0">
                  {contactsLoading ? (
                    <p className="p-4 text-sm text-gray-500">Loading contacts…</p>
                  ) : contacts.length === 0 ? (
                    <p className="p-4 text-sm text-gray-500">No contacts found.</p>
                  ) : (
                    <ul className="divide-y divide-gray-100">
                      {contacts.map((contact) => {
                        const name = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email;
                        return (
                          <li key={contact.userId}>
                            <button
                              type="button"
                              onClick={() => handleContactSelect(contact)}
                              className="w-full flex items-center gap-3 px-3 py-3 text-left hover:bg-gray-50"
                            >
                              <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {initialsFromName(name)}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                                <p className="text-xs text-gray-500 truncate">
                                  {contact.jobTitle || contact.departmentName || contact.email}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          )}
        </aside>

        {/* Thread */}
        <div className={`${mobileShowConversation ? 'flex' : 'hidden lg:flex'} flex-1 min-w-0 min-h-0`}>
          {selected ? (
            <ChatConversationPane
              conversation={selected}
              myUserId={myUserId}
              myInitials={myInitials}
              onlineUsers={onlineUsers}
              onBack={() => setMobileShowConversation(false)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-white border border-gray-200 rounded-xl">
              <div className="text-center p-8 max-w-sm">
                <div className="mx-auto w-12 h-12 rounded-full bg-primary-50 text-primary-600 flex items-center justify-center mb-3">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75c0 4.556 4.694 7.5 9.75 7.5s9.75-2.944 9.75-7.5-4.694-7.5-9.75-7.5-9.75 2.944-9.75 7.5z" />
                  </svg>
                </div>
                <h3 className="text-sm font-semibold text-gray-900">
                  {loading ? 'Loading conversations…' : 'Select a conversation'}
                </h3>
                <p className="text-xs text-gray-500 mt-1">
                  Choose a chat from the list or start a new one from your contacts.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
