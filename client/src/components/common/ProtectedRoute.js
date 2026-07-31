import React, { useContext } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { PermissionContext } from '../../contexts/PermissionContext';

const EMPLOYEE_APP_URL = process.env.REACT_APP_EMPLOYEE_APP_URL || 'https://employee.brightnow.online';

function hasAdminPortalAccess(hasPermission) {
  if (!hasPermission) return false;
  if (hasPermission('ADMIN', 'VIEW_ANALYTICS')) return true;
  if (hasPermission('ADMIN', 'MANAGE_USERS')) return true;
  if (hasPermission('ADMIN', 'MANAGE_ROLES')) return true;
  if (hasPermission('ADMIN', 'MANAGE_OFFICE_LOCATIONS')) return true;
  if (hasPermission('NEWS', 'EDIT') || hasPermission('NEWS', 'CREATE')) return true;
  if (hasPermission('DOCUMENTS', 'EDIT') || hasPermission('DOCUMENTS', 'CREATE')) return true;
  return false;
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const permissionCtx = useContext(PermissionContext);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (user?.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  // Allow change-password even without admin perms (must_change_password flow).
  // Otherwise demoted / Employee-only users must not keep the admin shell.
  if (
    location.pathname !== '/change-password'
    && permissionCtx
    && !hasAdminPortalAccess(permissionCtx.hasPermission)
  ) {
    window.location.replace(EMPLOYEE_APP_URL);
    return null;
  }

  return children;
}
