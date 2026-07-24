import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { chatService } from '../../services/chatService';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';

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

/**
 * Right-side 1:1 chat drawer for admin User/Employee detail pages.
 */
export default function ChatDrawer({
  open,
  onClose,
  userId,
  displayName,
  jobTitle,
  avatarUrl,
}) {
  const { user } = useAuth();
  const { socket, isConnected, onlineUsers } = useSocket();
  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingConv, setLoadingConv] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const typingTimeout = useRef(null);
  const openUserIdRef = useRef(null);

  const myUserId = user?.user_id;
  const myInitials = useMemo(
    () => initialsFromName([user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email),
    [user],
  );
  const contactInitials = useMemo(() => initialsFromName(displayName), [displayName]);
  const contactAvatar = mediaUrl(avatarUrl);
  const isOnline = useMemo(() => {
    if (!onlineUsers || userId == null) return false;
    const target = Number(userId);
    for (const id of onlineUsers) {
      if (Number(id) === target) return true;
    }
    return false;
  }, [onlineUsers, userId]);

  // Escape to close
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Open → create/get conversation + load messages
  useEffect(() => {
    if (!open || !userId) {
      setConversation(null);
      setMessages([]);
      setError(null);
      setHasMore(false);
      setPage(1);
      openUserIdRef.current = null;
      return undefined;
    }

    let cancelled = false;
    openUserIdRef.current = userId;
    setLoadingConv(true);
    setError(null);
    setConversation(null);
    setMessages([]);

    chatService
      .createConversation(Number(userId))
      .then((res) => {
        if (cancelled || openUserIdRef.current !== userId) return;
        const conv = res.data?.data;
        setConversation(conv || null);
        if (!conv?.id) {
          setError('Could not open conversation');
          return null;
        }
        setLoadingMsgs(true);
        return chatService.getMessages(conv.id, { page: 1, limit: 50 }).then((msgRes) => {
          if (cancelled || openUserIdRef.current !== userId) return;
          const data = msgRes.data?.data;
          setMessages(data?.messages || []);
          setHasMore(Boolean(data?.pagination?.hasNextPage));
          setPage(1);
          chatService.markAsRead(conv.id).catch(() => {});
        });
      })
      .catch((err) => {
        if (cancelled) return;
        const msg = err.response?.data?.message || 'User not available for chat';
        setError(msg);
        setConversation(null);
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingConv(false);
          setLoadingMsgs(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, userId]);

  // Join room + listeners
  useEffect(() => {
    if (!open || !socket || !conversation?.id) return undefined;

    socket.emit('chat:join', { conversationId: conversation.id });

    const handleReceive = ({ conversationId, message }) => {
      if (String(conversationId) !== String(conversation.id)) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      chatService.markAsRead(conversation.id).catch(() => {});
      socket.emit('chat:read', { conversationId: conversation.id });
    };

    const handleTyping = ({ conversationId, userId: typingUserId, isTyping }) => {
      if (String(conversationId) !== String(conversation.id)) return;
      if (Number(typingUserId) === Number(myUserId)) return;
      if (isTyping) {
        setTyping(true);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTyping(false), 3000);
      } else {
        setTyping(false);
      }
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:typing', handleTyping);

    return () => {
      socket.emit('chat:leave', { conversationId: conversation.id });
      socket.off('chat:receive', handleReceive);
      socket.off('chat:typing', handleTyping);
      clearTimeout(typingTimeout.current);
      setTyping(false);
    };
  }, [open, socket, conversation?.id, myUserId]);

  const handleLoadMore = useCallback(async () => {
    if (!conversation?.id || loadingMsgs || !hasMore) return;
    const nextPage = page + 1;
    setLoadingMsgs(true);
    try {
      const res = await chatService.getMessages(conversation.id, { page: nextPage, limit: 50 });
      const data = res.data?.data;
      const older = data?.messages || [];
      setMessages((prev) => {
        const ids = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !ids.has(m.id)), ...prev];
      });
      setHasMore(Boolean(data?.pagination?.hasNextPage));
      setPage(nextPage);
    } catch {
      /* ignore */
    } finally {
      setLoadingMsgs(false);
    }
  }, [conversation?.id, loadingMsgs, hasMore, page]);

  const handleSend = useCallback(
    (text) => {
      if (!socket || !conversation?.id || !isConnected) return;
      socket.emit(
        'chat:send',
        { conversationId: conversation.id, content: text },
        () => {},
      );
    },
    [socket, conversation?.id, isConnected],
  );

  const handleTyping = useCallback(
    (isTyping) => {
      if (!socket || !conversation?.id) return;
      socket.emit('chat:typing', { conversationId: conversation.id, isTyping });
    },
    [socket, conversation?.id],
  );

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 bg-black/40 z-[60] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        className="fixed inset-y-0 right-0 z-[70] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-white shadow-2xl"
        role="dialog"
        aria-label={`Chat with ${displayName || 'user'}`}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-white shrink-0">
          <div className="relative shrink-0">
            {contactAvatar ? (
              <img
                src={contactAvatar}
                alt={displayName}
                className="w-10 h-10 rounded-full object-cover border border-gray-100"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold">
                {contactInitials}
              </div>
            )}
            {isOnline && (
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold text-gray-900 truncate">{displayName || 'User'}</h2>
            <p className="text-xs text-gray-500 truncate">
              {!isConnected
                ? 'Reconnecting…'
                : isOnline
                  ? 'Online'
                  : jobTitle || 'Offline'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100"
            aria-label="Close chat"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error ? (
          <div className="flex-1 min-h-0 flex items-center justify-center p-8 text-center">
            <div>
              <p className="text-sm font-medium text-gray-800">Unable to chat</p>
              <p className="text-xs text-gray-500 mt-2">{error}</p>
            </div>
          </div>
        ) : loadingConv && !conversation ? (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <MessageList
              messages={messages}
              loading={loadingMsgs}
              hasMore={hasMore}
              onLoadMore={handleLoadMore}
              typing={typing}
              myUserId={myUserId}
              myInitials={myInitials}
              contactInitials={contactInitials}
              contactAvatar={contactAvatar}
              conversationKey={conversation?.id}
            />
            <ChatComposer
              onSend={handleSend}
              onTyping={handleTyping}
              disabled={!isConnected || !conversation?.id}
              placeholder={isConnected ? 'Type a message…' : 'Reconnecting…'}
            />
          </div>
        )}
      </aside>
    </>,
    document.body,
  );
}
