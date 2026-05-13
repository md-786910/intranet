import React from 'react';
import { useAuth } from '../../hooks/useAuth';

const SCOPE_RANK = { DEPARTMENT: 4, VERTICAL: 3, OFFICE_LOCATION: 2, ORGANISATION: 1 };

function pickPrimaryAssignment(assignments) {
  const subOrg = assignments.filter((a) => a.scope_type !== 'ORGANISATION');
  if (subOrg.length === 0) return null;
  return [...subOrg].sort(
    (a, b) => (SCOPE_RANK[b.scope_type] || 0) - (SCOPE_RANK[a.scope_type] || 0),
  )[0];
}

export default function Header() {
  const { user, logout, isOwner, roleAssignments } = useAuth();

  const primaryAssignment = !isOwner ? pickPrimaryAssignment(roleAssignments || []) : null;
  const scopeBadge = primaryAssignment
    ? [primaryAssignment.role?.name, primaryAssignment.scope_label].filter(Boolean).join(' · ')
    : null;

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-gray-800">
          Welcome back, {user?.first_name || 'User'}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {user?.first_name} {user?.last_name}
          </p>
          <p className="text-xs text-gray-500">{user?.email}</p>
          {scopeBadge && (
            <p className="text-xs text-primary-600 mt-0.5">{scopeBadge}</p>
          )}
        </div>

        <button
          onClick={logout}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
          </svg>
          Logout
        </button>
      </div>
    </header>
  );
}
