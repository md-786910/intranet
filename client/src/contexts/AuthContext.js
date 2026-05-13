import React, { createContext, useState, useCallback, useEffect } from 'react';
import api, { setTokens, clearTokens, getRefreshToken } from '../config/api';

export const AuthContext = createContext(null);
let authBootstrapPromise = null;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [roleAssignments, setRoleAssignments] = useState([]);
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Hydrate React state + localStorage from a server-issued session payload.
  // Shared by password login and Microsoft SSO so both paths produce identical state.
  const setSession = useCallback(async ({ accessToken, refreshToken, user: userData, permissions: perms }) => {
    setTokens(accessToken, refreshToken);
    setUser(userData);
    setPermissions(perms || {});
    setIsAuthenticated(true);

    try {
      const meResponse = await api.get('/auth/me');
      const { role_assignments, is_owner } = meResponse.data.data;
      setRoleAssignments(role_assignments || []);
      setIsOwner(Boolean(is_owner));
    } catch {
      setRoleAssignments([]);
      setIsOwner(false);
    }

    return userData;
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await api.post('/auth/login', { email, password, audience: 'admin' });
    return setSession(response.data.data);
  }, [setSession]);

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
      setRoleAssignments([]);
      setIsOwner(false);
      setIsAuthenticated(false);
    }
  }, []);

  // Attempt silent refresh on app mount
  useEffect(() => {
    const bootstrapAuth = async () => {
      const refreshToken = getRefreshToken();
      if (!refreshToken) {
        return {
          user: null,
          permissions: {},
          isAuthenticated: false,
        };
      }

      try {
        const response = await api.post('/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = response.data.data;
        setTokens(accessToken, newRefresh);

        // Fetch user profile
        const meResponse = await api.get('/auth/me');
        const {
          user: userData,
          permissions: perms,
          role_assignments,
          is_owner,
        } = meResponse.data.data;
        return {
          user: userData,
          permissions: perms || {},
          roleAssignments: role_assignments || [],
          isOwner: Boolean(is_owner),
          isAuthenticated: true,
        };
      } catch {
        clearTokens();
        return {
          user: null,
          permissions: {},
          roleAssignments: [],
          isOwner: false,
          isAuthenticated: false,
        };
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
        setRoleAssignments(result.roleAssignments || []);
        setIsOwner(Boolean(result.isOwner));
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
    permissions,
    roleAssignments,
    isOwner,
    isLoading,
    isAuthenticated,
    login,
    logout,
    setSession,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
