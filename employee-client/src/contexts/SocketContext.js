import React, { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { getAccessToken } from '../config/api';

const SocketContext = createContext(null);

const SOCKET_URL = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1')
  .replace('/api/v1', '');

export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [lastSeenUpdates, setLastSeenUpdates] = useState({});
  const socketRef = useRef(null);
  const reconnectAttempt = useRef(0);

  const connect = useCallback(() => {
    const token = getAccessToken();
    if (!token) return;

    // Disconnect existing socket if any
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

      // Request current online users
      newSocket.emit('presence:list', null, (response) => {
        if (response?.onlineUserIds) {
          setOnlineUsers(new Set(response.onlineUserIds));
        }
      });
    });

    newSocket.on('disconnect', (reason) => {
      setIsConnected(false);
      if (reason === 'io server disconnect') {
        // Server forced disconnect — try reconnecting with fresh token
        setTimeout(() => {
          reconnectAttempt.current += 1;
          connect();
        }, Math.min(1000 * Math.pow(2, reconnectAttempt.current), 10000));
      }
    });

    newSocket.on('connect_error', (error) => {
      setIsConnected(false);
      if (error.message === 'Authentication required') {
        // Token might be expired; component can handle re-auth
        reconnectAttempt.current += 1;
      }
    });

    // Online presence tracking
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

    socketRef.current = newSocket;
    setSocket(newSocket);
  }, []);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setSocket(null);
      setIsConnected(false);
      setOnlineUsers(new Set());
    }
  }, []);

  // Auto-connect when component mounts (if we have a token)
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      connect();
    }
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    lastSeenUpdates,
    connect,
    disconnect,
  };

  return (
    <SocketContext.Provider value={value}>
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
