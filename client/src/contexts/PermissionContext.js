import React, { createContext, useContext, useMemo } from 'react';
import { AuthContext } from './AuthContext';

export const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { permissions } = useContext(AuthContext);

  const value = useMemo(() => ({
    permissions,
    hasPermission: (moduleCode, actionCode) => {
      if (!permissions || !permissions[moduleCode]) return false;
      return permissions[moduleCode].includes(actionCode);
    },
  }), [permissions]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}
