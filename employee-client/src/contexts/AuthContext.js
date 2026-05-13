import React, { createContext, useState, useCallback, useEffect } from 'react';
import api, { setTokens, clearTokens, getRefreshToken } from '../config/api';

export const AuthContext = createContext(null);
let authBootstrapPromise = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const applyAuthResult = useCallback((accessToken, refreshToken, userData, perms) => {
    setTokens(accessToken, refreshToken);
    setUser(userData);
    setPermissions(perms || {});
    setIsAuthenticated(true);
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password, audience: 'employee' });
    const { accessToken, refreshToken, user: userData, permissions: perms } = response.data.data;
    applyAuthResult(accessToken, refreshToken, userData, perms);
    return userData;
  }, [applyAuthResult]);

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

  // Allow the invitation/reset flows to drop tokens straight in (auto-login)
  const setAuthFromTokens = useCallback(async (accessToken, refreshToken, userData, perms) => {
    if (userData) {
      applyAuthResult(accessToken, refreshToken, userData, perms);
      return userData;
    }
    setTokens(accessToken, refreshToken);
    const meResponse = await api.get('/auth/me');
    const fetched = meResponse.data.data;
    applyAuthResult(accessToken, refreshToken, fetched.user, fetched.permissions);
    return fetched.user;
  }, [applyAuthResult]);

  useEffect(() => {
    const bootstrapAuth = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return { user: null, permissions: {}, isAuthenticated: false };
      }

      try {
        const response = await api.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data.data;
        setTokens(accessToken, newRefresh);

        const meResponse = await api.get('/auth/me');
        const { user: userData, permissions: perms } = meResponse.data.data;
        return { user: userData, permissions: perms || {}, isAuthenticated: true };
      } catch {
        clearTokens();
        return { user: null, permissions: {}, isAuthenticated: false };
      }
    };

    if (!authBootstrapPromise) {
      authBootstrapPromise = bootstrapAuth();
    }

    let isMounted = true;

    authBootstrapPromise
      .then((result) => {
        if (!isMounted) return;
        setUser(result.user);
        setPermissions(result.permissions);
        setIsAuthenticated(result.isAuthenticated);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const value = {
    user,
    setUser,
    permissions,
    isLoading,
    isAuthenticated,
    login,
    logout,
    setAuthFromTokens,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
