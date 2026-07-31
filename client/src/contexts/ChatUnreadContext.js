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

const FALLBACK_TITLE = 'BrightNOW Admin';

function formatTitle(total, baseTitle) {
  const base = baseTitle || FALLBACK_TITLE;
  if (!total || total <= 0) return base;
  const n = total > 99 ? '99+' : String(total);
  return `(${n}) ${base}`;
}

export function ChatUnreadProvider({ children }) {
  const { socket } = useSocket();
  const { user } = useAuth();
  const { metaTitle } = useAppBranding();
  const myUserId = user?.user_id != null ? Number(user.user_id) : null;
  const baseTitle = metaTitle || FALLBACK_TITLE;

  const [totalUnread, setTotalUnread] = useState(0);
  const activeIdRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const totalRes = await chatService.getUnreadTotal();
      setTotalUnread(Number(totalRes.data?.data?.total) || 0);
    } catch {
      // Keep last known count
    }
  }, []);

  const setActiveConversationId = useCallback((id) => {
    activeIdRef.current = id != null ? String(id) : null;
  }, []);

  const markConversationRead = useCallback(() => {
    // After mark-read API, re-fetch authoritative total (admin has no inbox map).
    refresh();
  }, [refresh]);

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
      setTotalUnread((t) => t + 1);
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

  const value = useMemo(
    () => ({
      totalUnread,
      setActiveConversationId,
      markConversationRead,
      refresh,
    }),
    [totalUnread, setActiveConversationId, markConversationRead, refresh],
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
      setActiveConversationId: () => {},
      markConversationRead: () => {},
      refresh: async () => {},
      // Stubs for employee-portal API shape — admin context has no per-convo map.
      getUnreadFor: () => 0,
      perConvo: {},
      syncFromConversations: () => {},
    };
  }
  return {
    getUnreadFor: () => 0,
    perConvo: {},
    syncFromConversations: () => {},
    ...ctx,
  };
}
