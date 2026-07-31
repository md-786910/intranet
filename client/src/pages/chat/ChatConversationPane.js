import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '../../contexts/SocketContext';
import { useChatUnread } from '../../contexts/ChatUnreadContext';
import { chatService } from '../../services/chatService';
import MessageList from '../../components/chat/MessageList';
import ChatComposer from '../../components/chat/ChatComposer';

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

export default function ChatConversationPane({
  conversation,
  myUserId,
  myInitials,
  onlineUsers,
  onBack,
}) {
  const { socket, isConnected } = useSocket();
  const { markConversationRead, setActiveConversationId } = useChatUnread();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [typing, setTyping] = useState(false);
  const typingTimeout = useRef(null);

  const other = conversation?.otherUser;
  const displayName = [other?.firstName, other?.lastName].filter(Boolean).join(' ') || 'User';
  const contactInitials = useMemo(() => initialsFromName(displayName), [displayName]);
  const contactAvatar = mediaUrl(other?.avatarUrl);
  const isOnline = useMemo(() => {
    if (!onlineUsers || other?.userId == null) return false;
    const target = Number(other.userId);
    for (const id of onlineUsers) {
      if (Number(id) === target) return true;
    }
    return false;
  }, [onlineUsers, other?.userId]);

  useEffect(() => {
    if (!conversation?.id) return undefined;
    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setHasMore(false);
    setPage(1);
    setActiveConversationId(conversation.id);

    chatService
      .getMessages(conversation.id, { page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setMessages(data?.messages || []);
        setHasMore(Boolean(data?.pagination?.hasNextPage));
      })
      .catch(() => {
        if (!cancelled) setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    chatService.markAsRead(conversation.id).catch(() => {});
    markConversationRead(conversation.id);

    return () => {
      cancelled = true;
      setActiveConversationId(null);
    };
  }, [conversation?.id, markConversationRead, setActiveConversationId]);

  useEffect(() => {
    if (!socket || !conversation?.id) return undefined;

    socket.emit('chat:join', { conversationId: conversation.id });

    const handleReceive = ({ conversationId, message }) => {
      if (String(conversationId) !== String(conversation.id)) return;
      setMessages((prev) => {
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      chatService.markAsRead(conversation.id).catch(() => {});
      markConversationRead(conversation.id);
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

    const handleEdited = ({ conversationId, message }) => {
      if (String(conversationId) !== String(conversation.id) || !message) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === message.id ? { ...m, ...message } : m)),
      );
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:edited', handleEdited);

    return () => {
      socket.emit('chat:leave', { conversationId: conversation.id });
      socket.off('chat:receive', handleReceive);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:edited', handleEdited);
      clearTimeout(typingTimeout.current);
      setTyping(false);
    };
  }, [socket, conversation?.id, myUserId, markConversationRead]);

  const handleLoadMore = useCallback(async () => {
    if (!conversation?.id || loading || !hasMore) return;
    const nextPage = page + 1;
    setLoading(true);
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
      setLoading(false);
    }
  }, [conversation?.id, loading, hasMore, page]);

  const handleSend = useCallback(
    (text) => {
      if (!socket || !conversation?.id || !isConnected) return;
      socket.emit('chat:send', { conversationId: conversation.id, content: text }, () => {});
    },
    [socket, conversation?.id, isConnected],
  );

  const handleEditMessage = useCallback(
    (messageId, content) =>
      new Promise((resolve, reject) => {
        if (!socket || !isConnected) {
          reject(new Error('Not connected'));
          return;
        }
        socket.emit('chat:edit', { messageId, content }, (response) => {
          if (response?.error) {
            reject(new Error(response.error));
            return;
          }
          if (response?.message) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === response.message.id ? { ...m, ...response.message } : m,
              ),
            );
          }
          resolve(response?.message);
        });
      }),
    [socket, isConnected],
  );

  const handleTyping = useCallback(
    (isTyping) => {
      if (!socket || !conversation?.id) return;
      socket.emit('chat:typing', { conversationId: conversation.id, isTyping });
    },
    [socket, conversation?.id],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="lg:hidden p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
            aria-label="Back to conversations"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
        )}
        <div className="relative shrink-0">
          {contactAvatar ? (
            <img src={contactAvatar} alt="" className="w-10 h-10 rounded-full object-cover border border-gray-100" />
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
          <h2 className="text-sm font-semibold text-gray-900 truncate">{displayName}</h2>
          <p className="text-xs text-gray-500 truncate">
            {!isConnected ? 'Reconnecting…' : isOnline ? 'Online' : (other?.jobTitle || 'Offline')}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <MessageList
          messages={messages}
          loading={loading}
          hasMore={hasMore}
          onLoadMore={handleLoadMore}
          typing={typing}
          myUserId={myUserId}
          myInitials={myInitials}
          contactInitials={contactInitials}
          contactAvatar={contactAvatar}
          conversationKey={conversation?.id}
          onEditMessage={handleEditMessage}
        />
        <ChatComposer
          onSend={handleSend}
          onTyping={handleTyping}
          disabled={!isConnected || !conversation?.id}
          placeholder={isConnected ? 'Type a message…' : 'Reconnecting…'}
        />
      </div>
    </div>
  );
}
