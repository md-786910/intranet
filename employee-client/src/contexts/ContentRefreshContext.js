import React, {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useSocket } from './SocketContext';

const ContentRefreshContext = createContext(null);

const EMPTY = Object.freeze({
  news: 0,
  document: 0,
  announcement: 0,
  any: 0,
});

const DEBOUNCE_MS = 400;

/**
 * Listens for notification:new / notification:nudge and bumps typed refresh
 * counters so Home widgets can refetch list APIs without a full page reload.
 */
export function ContentRefreshProvider({ children }) {
  const { socket } = useSocket();
  const [keys, setKeys] = useState(EMPTY);
  const pendingRef = useRef(new Set());
  const timerRef = useRef(null);

  const flush = useCallback(() => {
    timerRef.current = null;
    const pending = pendingRef.current;
    if (pending.size === 0) return;
    setKeys((prev) => {
      const next = { ...prev, any: prev.any + 1 };
      if (pending.has('NEWS')) next.news += 1;
      if (pending.has('DOCUMENT')) next.document += 1;
      if (pending.has('ANNOUNCEMENT')) next.announcement += 1;
      return next;
    });
    pending.clear();
  }, []);

  const schedule = useCallback((types) => {
    types.forEach((t) => pendingRef.current.add(t));
    if (timerRef.current) return;
    timerRef.current = setTimeout(flush, DEBOUNCE_MS);
  }, [flush]);

  useEffect(() => {
    if (!socket) return undefined;

    const onNotify = ({ notification }) => {
      const type = notification?.type;
      if (type === 'NEWS' || type === 'DOCUMENT' || type === 'ANNOUNCEMENT') {
        schedule([type]);
      } else {
        schedule(['NEWS', 'DOCUMENT', 'ANNOUNCEMENT']);
      }
    };

    const onConnect = () => {
      schedule(['NEWS', 'DOCUMENT', 'ANNOUNCEMENT']);
    };

    socket.on('notification:new', onNotify);
    socket.on('notification:nudge', onNotify);
    socket.on('connect', onConnect);
    return () => {
      socket.off('notification:new', onNotify);
      socket.off('notification:nudge', onNotify);
      socket.off('connect', onConnect);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [socket, schedule]);

  const value = useMemo(() => keys, [keys]);

  return (
    <ContentRefreshContext.Provider value={value}>
      {children}
    </ContentRefreshContext.Provider>
  );
}

export function useContentRefresh() {
  return useContext(ContentRefreshContext) || EMPTY;
}
