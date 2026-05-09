import React, { useCallback, useEffect, useRef, useState } from 'react';
import ChatHeader from './ChatHeader';
import MessageList from './MessageList';
import ChatComposer from './ChatComposer';
import { useSocket } from '../../../contexts/SocketContext';
import { chatService } from '../../../services/chatService';

export default function ConversationView({
  conversation,
  myInitials,
  myUserId,
  onlineUsers,
  onBack,
  className = '',
}) {
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(1);
  const [typingUserId, setTypingUserId] = useState(null);
  const typingTimeout = useRef(null);
  const prevConvId = useRef(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversation?.id) return;

    // Only reload if conversation actually changed
    if (prevConvId.current === conversation.id) return;
    prevConvId.current = conversation.id;

    let cancelled = false;
    setLoading(true);
    setMessages([]);
    setPage(1);

    chatService
      .getMessages(conversation.id, { page: 1, limit: 50 })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data;
        setMessages(data?.messages || []);
        setHasMore(data?.pagination?.hasNextPage || false);
      })
      .catch(() => {
        if (cancelled) return;
        setMessages([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // Mark as read
    chatService.markAsRead(conversation.id).catch(() => {});

    // Join conversation room for typing indicators
    if (socket) {
      socket.emit('chat:join', { conversationId: conversation.id });
    }

    return () => {
      cancelled = true;
      if (socket && conversation?.id) {
        socket.emit('chat:leave', { conversationId: conversation.id });
      }
    };
  }, [conversation?.id, socket]);

  // Listen for incoming messages
  useEffect(() => {
    if (!socket || !conversation?.id) return;

    const handleReceive = ({ conversationId, message }) => {
      if (conversationId !== conversation.id) return;
      setMessages((prev) => {
        // Avoid duplicates
        if (prev.find((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      // Mark as read since we're viewing this conversation
      chatService.markAsRead(conversation.id).catch(() => {});
      socket.emit('chat:read', { conversationId: conversation.id });
    };

    const handleTyping = ({ conversationId, userId, isTyping }) => {
      if (conversationId !== conversation.id) return;
      if (userId === myUserId) return;
      if (isTyping) {
        setTypingUserId(userId);
        clearTimeout(typingTimeout.current);
        typingTimeout.current = setTimeout(() => setTypingUserId(null), 3000);
      } else {
        setTypingUserId(null);
      }
    };

    const handleRead = ({ conversationId }) => {
      // Could update read receipts UI here
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);

    return () => {
      socket.off('chat:receive', handleReceive);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      clearTimeout(typingTimeout.current);
    };
  }, [socket, conversation?.id, myUserId]);

  // Load more messages (pagination)
  const handleLoadMore = useCallback(async () => {
    if (!conversation?.id || loading || !hasMore) return;

    const nextPage = page + 1;
    setLoading(true);
    try {
      const res = await chatService.getMessages(conversation.id, {
        page: nextPage,
        limit: 50,
      });
      const data = res.data?.data;
      const older = data?.messages || [];
      setMessages((prev) => [...older, ...prev]);
      setHasMore(data?.pagination?.hasNextPage || false);
      setPage(nextPage);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [conversation?.id, loading, hasMore, page]);

  // Send message via socket
  const handleSend = useCallback(
    (text) => {
      if (!socket || !conversation?.id) return;
      socket.emit(
        'chat:send',
        { conversationId: conversation.id, content: text },
        (response) => {
          if (response?.error) {
            // Could show toast here
          }
        },
      );
    },
    [socket, conversation?.id],
  );

  // Typing indicator
  const handleTyping = useCallback(
    (isTyping) => {
      if (!socket || !conversation?.id) return;
      socket.emit('chat:typing', { conversationId: conversation.id, isTyping });
    },
    [socket, conversation?.id],
  );

  if (!conversation) return null;

  const other = conversation.otherUser;
  const isOnline = onlineUsers?.has(other?.userId);

  return (
    <section
      className={`flex flex-col bg-white border border-outline-variant rounded-xl shadow-sm overflow-hidden h-full ${className}`}
    >
      <ChatHeader contact={other} isOnline={isOnline} onBack={onBack} />
      <MessageList
        messages={messages}
        contact={other}
        myInitials={myInitials}
        myUserId={myUserId}
        loading={loading}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        typingUserId={typingUserId}
      />
      <ChatComposer onSend={handleSend} onTyping={handleTyping} />
    </section>
  );
}
