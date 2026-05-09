import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import MessagesSidebar from './sidebar/MessagesSidebar';
import ConversationView from './conversation/ConversationView';
import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../contexts/SocketContext';
import { chatService } from '../../services/chatService';

export default function PeoplePage() {
  const { user } = useAuth();
  const { socket, onlineUsers } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Mobile: when true, show conversation pane (hide sidebar)
  const [mobileShowConversation, setMobileShowConversation] = useState(false);

  const myInitials = useMemo(() => {
    const f = user?.first_name?.[0] || '';
    const l = user?.last_name?.[0] || '';
    const ji = (f + l).toUpperCase();
    return ji || (user?.email?.[0] || 'U').toUpperCase();
  }, [user]);

  // Load conversations on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    chatService
      .getConversations()
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || [];
        setConversations(data);
        // Auto-select first conversation if none selected
        if (data.length > 0 && !selectedId) {
          setSelectedId(data[0].id);
        }
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

  // Handle ?userId= query param from Home page "Chat" button
  useEffect(() => {
    const targetUserId = searchParams.get('userId');
    if (!targetUserId || loading) return;

    const numId = parseInt(targetUserId, 10);
    if (!numId) return;

    // Check if we already have a conversation with this user
    const existing = conversations.find(
      (c) => c.otherUser?.userId === numId,
    );
    if (existing) {
      setSelectedId(existing.id);
      setMobileShowConversation(true);
      setSearchParams({}, { replace: true });
      return;
    }

    // Create a new conversation
    chatService
      .createConversation(numId)
      .then((res) => {
        const conv = res.data?.data;
        if (conv) {
          setConversations((prev) => {
            // Avoid duplicates
            if (prev.find((c) => c.id === conv.id)) return prev;
            return [conv, ...prev];
          });
          setSelectedId(conv.id);
          setMobileShowConversation(true);
        }
        setSearchParams({}, { replace: true });
      })
      .catch(() => {
        setSearchParams({}, { replace: true });
      });
  }, [searchParams, loading, conversations, setSearchParams]);

  // Listen for incoming messages via socket
  useEffect(() => {
    if (!socket) return;

    const handleReceive = ({ conversationId, message }) => {
      setConversations((prev) => {
        const exists = prev.find((c) => c.id === conversationId);
        if (exists) {
          // Update existing conversation's last message
          return prev
            .map((c) => {
              if (c.id !== conversationId) return c;
              return {
                ...c,
                lastMessage: {
                  id: message.id,
                  content: message.content,
                  senderId: message.senderId,
                  createdAt: message.createdAt,
                },
                updatedAt: message.createdAt,
                unreadCount:
                  conversationId === selectedId
                    ? c.unreadCount
                    : (c.unreadCount || 0) + 1,
              };
            })
            .sort((a, b) => {
              if (!a.updatedAt && !b.updatedAt) return 0;
              if (!a.updatedAt) return 1;
              if (!b.updatedAt) return -1;
              return new Date(b.updatedAt) - new Date(a.updatedAt);
            });
        }
        // New conversation — reload the list
        chatService.getConversations().then((res) => {
          setConversations(res.data?.data || []);
        });
        return prev;
      });
    };

    socket.on('chat:receive', handleReceive);
    return () => socket.off('chat:receive', handleReceive);
  }, [socket, selectedId]);

  const handleSelect = useCallback((id) => {
    setSelectedId(id);
    setMobileShowConversation(true);

    // Mark as read
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }, []);

  const handleNewConversation = useCallback((conv) => {
    setConversations((prev) => {
      if (prev.find((c) => c.id === conv.id)) return prev;
      return [conv, ...prev];
    });
    setSelectedId(conv.id);
    setMobileShowConversation(true);
  }, []);

  const selected = conversations.find((c) => c.id === selectedId) || null;

  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg flex gap-gutter overflow-hidden h-[calc(100vh-11rem)]">
      <MessagesSidebar
        conversations={conversations}
        selectedId={selectedId}
        onSelect={handleSelect}
        onNewConversation={handleNewConversation}
        onlineUsers={onlineUsers}
        loading={loading}
        error={error}
        className={`${mobileShowConversation ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 shrink-0`}
      />
      {selected ? (
        <ConversationView
          conversation={selected}
          myInitials={myInitials}
          myUserId={user?.user_id}
          onlineUsers={onlineUsers}
          onBack={() => setMobileShowConversation(false)}
          className={`${mobileShowConversation ? 'flex' : 'hidden lg:flex'} flex-grow`}
        />
      ) : (
        <div
          className={`${mobileShowConversation ? 'flex' : 'hidden lg:flex'} flex-grow items-center justify-center bg-white border border-outline-variant rounded-xl shadow-sm`}
        >
          <div className="text-center p-8">
            <span className="material-symbols-rounded text-5xl text-outline mb-4 block">
              forum
            </span>
            <h3 className="font-h3 text-h3 text-on-surface mb-2">
              {loading ? 'Loading conversations...' : 'Select a conversation'}
            </h3>
            <p className="text-body-sm text-on-surface-variant">
              {loading
                ? 'Fetching your messages...'
                : 'Choose a chat from the sidebar or start a new conversation'}
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
