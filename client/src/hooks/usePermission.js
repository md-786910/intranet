import { useContext, useMemo } from 'react';
import { PermissionContext } from '../contexts/PermissionContext';

export function usePermission(moduleCode, actionCode) {
  const { permissions } = useContext(PermissionContext);

  const hasPermission = useMemo(() => {
    if (!permissions || !permissions[moduleCode]) return false;
    return permissions[moduleCode].includes(actionCode);
  }, [permissions, moduleCode, actionCode]);

  return { hasPermission };
}
