import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from '../hooks/useAuth';
import { useAppBranding } from './AppBrandingContext';
import { chatService } from '../services/chatService';

const ChatUnreadContext = createContext(null);

const FALLBACK_TITLE = 'BrightNOW';

function formatTitle(total, baseTitle) {
  const base = baseTitle || FALLBACK_TITLE;
  if (!total || total <= 0) return base;
  const n = total > 99 ? '99+' : String(total);
  return `(${n}) ${base}`;
}

function sumMap(map) {
  let total = 0;
  Object.values(map).forEach((n) => {
    total += Number(n) || 0;
  });
  return total;
}

export function ChatUnreadProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { metaTitle } = useAppBranding();
  const myUserId = user?.user_id != null ? Number(user.user_id) : null;
  const baseTitle = metaTitle || FALLBACK_TITLE;

  const [perConvo, setPerConvo] = useState({});
  const [totalUnread, setTotalUnread] = useState(0);
  const activeIdRef = useRef(null);

  const applyTotalFromMap = useCallback((map) => {
    setPerConvo(map);
    setTotalUnread(sumMap(map));
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [totalRes, listRes] = await Promise.all([
        chatService.getUnreadTotal(),
        chatService.getConversations().catch(() => null),
      ]);
      const total = Number(totalRes.data?.data?.total) || 0;
      const list = listRes?.data?.data;
      if (Array.isArray(list)) {
        const map = {};
        list.forEach((c) => {
          if (c?.id != null && c.unreadCount > 0) {
            map[String(c.id)] = Number(c.unreadCount) || 0;
          }
        });
        applyTotalFromMap(map);
        // Prefer summed map; fall back to API total if map empty but total > 0
        if (sumMap(map) === 0 && total > 0) setTotalUnread(total);
      } else {
        setTotalUnread(total);
      }
    } catch {
      // Keep last known counts
    }
  }, [applyTotalFromMap]);

  const syncFromConversations = useCallback((conversations) => {
    if (!Array.isArray(conversations)) return;
    const map = {};
    conversations.forEach((c) => {
      if (c?.id != null && c.unreadCount > 0) {
        map[String(c.id)] = Number(c.unreadCount) || 0;
      }
    });
    applyTotalFromMap(map);
  }, [applyTotalFromMap]);

  const setActiveConversationId = useCallback((id) => {
    activeIdRef.current = id != null ? String(id) : null;
  }, []);

  const markConversationRead = useCallback((conversationId) => {
    if (conversationId == null) return;
    const key = String(conversationId);
    setPerConvo((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      setTotalUnread(sumMap(next));
      return next;
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    document.title = formatTitle(totalUnread, baseTitle);
    return () => {
      document.title = baseTitle;
    };
  }, [totalUnread, baseTitle]);

  useEffect(() => {
    if (!socket || myUserId == null) return undefined;

    const onReceive = ({ conversationId, message }) => {
      if (!message || conversationId == null) return;
      if (Number(message.senderId) === myUserId) return;
      const key = String(conversationId);
      if (activeIdRef.current && activeIdRef.current === key) return;

      setPerConvo((prev) => {
        const next = { ...prev, [key]: (Number(prev[key]) || 0) + 1 };
        setTotalUnread(sumMap(next));
        return next;
      });
    };

    const onConnect = () => {
      refresh();
    };

    socket.on('chat:receive', onReceive);
    socket.on('connect', onConnect);
    return () => {
      socket.off('chat:receive', onReceive);
      socket.off('connect', onConnect);
    };
  }, [socket, myUserId, refresh]);

  const getUnreadFor = useCallback(
    (conversationId) => {
      if (conversationId == null) return 0;
      return Number(perConvo[String(conversationId)]) || 0;
    },
    [perConvo],
  );

  const value = useMemo(
    () => ({
      totalUnread,
      perConvo,
      setActiveConversationId,
      markConversationRead,
      syncFromConversations,
      refresh,
      getUnreadFor,
    }),
    [
      totalUnread,
      perConvo,
      setActiveConversationId,
      markConversationRead,
      syncFromConversations,
      refresh,
      getUnreadFor,
    ],
  );

  return (
    <ChatUnreadContext.Provider value={value}>
      {children}
    </ChatUnreadContext.Provider>
  );
}

export function useChatUnread() {
  const ctx = useContext(ChatUnreadContext);
  if (!ctx) {
    return {
      totalUnread: 0,
      perConvo: {},
      setActiveConversationId: () => {},
      markConversationRead: () => {},
      syncFromConversations: () => {},
      refresh: async () => {},
      getUnreadFor: () => 0,
    };
  }
  return ctx;
}
