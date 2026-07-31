import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken, clearTokens } from '../config/api';
import { useAuth } from '../hooks/useAuth';

const SocketContext = createContext(null);

const SOCKET_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1')
  .replace(/\/api\/v1\/?$/, '');

export function SocketProvider({ children }) {
  const { logout } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenUpdates, setLastSeenUpdates] = useState({});
  const socketRef = useRef(null);
  const reconnectAttempt = useRef(0);
  const handlingSessionRevoke = useRef(false);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) return;

    if (socketRef.current) {
      socketRef.current.disconnect();
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      reconnectAttempt.current = 0;
      newSocket.emit('presence:list', null, (response) => {
        if (response?.onlineUserIds) {
          setOnlineUsers(new Set(response.onlineUserIds));
        }
      });
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        setTimeout(() => {
          reconnectAttempt.current += 1;
          connect();
        }, Math.min(1000 * 2 ** reconnectAttempt.current, 10000));
      }
    });

    newSocket.on('connect_error', () => {
      setIsConnected(false);
      reconnectAttempt.current += 1;
    });

    newSocket.on('presence:online', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.add(userId);
        return next;
      });
    });

    newSocket.on('presence:offline', ({ userId, lastSeenAt }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
      if (lastSeenAt) {
        setLastSeenUpdates((prev) => ({ ...prev, [userId]: lastSeenAt }));
      }
    });

    // Demoted from admin portal (e.g. role changed to Employee) — force local logout.
    newSocket.on('auth:session-revoked', async () => {
      if (handlingSessionRevoke.current) return;
      handlingSessionRevoke.current = true;
      try {
        newSocket.disconnect();
        await logout();
      } catch {
        clearTokens();
      } finally {
        window.location.replace(
          '/login?notice=' + encodeURIComponent(
            'Your admin access was removed. Sign in again or use the employee portal.',
          ),
        );
      }
    });

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, [logout]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    }
  }, []);

  useEffect(() => {
    if (getAccessToken()) connect();
    return () => {
      if (socketRef.current) socketRef.current.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <SocketContext.Provider
      value={{ socket, isConnected, onlineUsers, lastSeenUpdates, connect, disconnect }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
}
