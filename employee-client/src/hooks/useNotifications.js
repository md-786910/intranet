import { useCallback, useEffect, useState } from 'react';
import { notificationsService } from '../services/notificationsService';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from './useToast';

const FEED_LIMIT = 20;

// Short, friendly summary for the toast that pops up on a live notification.
// Falls back to a generic message when type isn't recognised.
function toastMessageFor(notification) {
  const title = notification.title || 'New update';
  if (notification.type === 'NEWS') return `New article: ${title}`;
  if (notification.type === 'DOCUMENT') return `New document: ${title}`;
  return title;
}

// Single source of truth for the bell. State comes from the DB on mount; the
// socket `notification:new` event simply prepends to the same in-memory list.
// That guarantees offline users see missed notifications on next portal load,
// and online users see new ones live without a reload.
export function useNotifications() {
  const { socket } = useSocket();
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchInitial = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.all([
        notificationsService.list({ limit: FEED_LIMIT }),
        notificationsService.unreadCount(),
      ]);
      setItems(listRes.data?.data || []);
      setUnreadCount(countRes.data?.data?.count || 0);
    } catch {
      setItems([]);
      setUnreadCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInitial();
  }, [fetchInitial]);

  // Live socket pushes. Treated as a cache update — the persisted DB row is
  // already there, the server emits to give us instant UI without a refetch.
  // Also fires an info toast so the user notices without watching the bell.
  useEffect(() => {
    if (!socket) return undefined;
    const handler = ({ notification }) => {
      if (!notification) return;
      let alreadySeen = false;
      setItems((prev) => {
        alreadySeen = prev.some(
          (n) => n.notification_id === notification.notification_id,
        );
        if (alreadySeen) return prev;
        return [notification, ...prev].slice(0, FEED_LIMIT);
      });
      // Skip the toast + badge bump if the socket re-emits the same row
      // (e.g. quick reconnect). Otherwise notify the user.
      if (alreadySeen) return;
      if (!notification.read_at) {
        setUnreadCount((c) => c + 1);
      }
      toast.info(toastMessageFor(notification));
    };
    socket.on('notification:new', handler);
    return () => {
      socket.off('notification:new', handler);
    };
  }, [socket, toast]);

  const markRead = useCallback(async (id) => {
    // Optimistic — flip locally first, then sync. Roll back on failure.
    let wasUnread = false;
    setItems((prev) =>
      prev.map((n) => {
        if (n.notification_id !== id) return n;
        if (!n.read_at) wasUnread = true;
        return { ...n, read_at: new Date().toISOString() };
      }),
    );
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    try {
      await notificationsService.markRead(id);
    } catch {
      // Roll back the optimistic update so the badge stays accurate.
      setItems((prev) =>
        prev.map((n) =>
          n.notification_id === id ? { ...n, read_at: null } : n,
        ),
      );
      if (wasUnread) setUnreadCount((c) => c + 1);
    }
  }, []);

  const markAllRead = useCallback(async () => {
    const previousItems = items;
    const previousCount = unreadCount;
    const now = new Date().toISOString();
    setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
    setUnreadCount(0);
    try {
      await notificationsService.markAllRead();
    } catch {
      setItems(previousItems);
      setUnreadCount(previousCount);
    }
  }, [items, unreadCount]);

  return {
    items,
    unreadCount,
    loading,
    markRead,
    markAllRead,
    refresh: fetchInitial,
  };
}
