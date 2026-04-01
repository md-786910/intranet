import React, { createContext, useState, useCallback, useEffect } from 'react';
import api, { setTokens, clearTokens, getRefreshToken } from '../config/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    const { accessToken, refreshToken, user: userData, permissions: perms } = response.data.data;

    setTokens(accessToken, refreshToken);
    setUser(userData);
    setPermissions(perms || {});
    setIsAuthenticated(true);

    return userData;
  }, []);

  const logout = useCallback(async () => {
    try {
      const refreshToken = getRefreshToken();
      await api.post('/auth/logout', { refreshToken });
    } catch {
      // Logout should succeed even if API call fails
    } finally {
      clearTokens();
      setUser(null);
      setPermissions({});
      setIsAuthenticated(false);
    }
  }, []);

  // Attempt silent refresh on app mount
  useEffect(() => {
    const tryRefresh = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data.data;
        setTokens(accessToken, newRefresh);

        // Fetch user profile
        const meResponse = await api.get('/auth/me');
        const { user: userData, permissions: perms } = meResponse.data.data;
        setUser(userData);
        setPermissions(perms || {});
        setIsAuthenticated(true);
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    tryRefresh();
  }, []);

  const value = {
    user,
    permissions,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
