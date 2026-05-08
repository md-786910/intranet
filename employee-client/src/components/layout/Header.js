import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function Header() {
  const { user, logout } = useAuth();

  const fullName = user
    ? [user.first_name, user.last_name].filter(Boolean).join(' ') || user.email
    : '';

  return (
    <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-gray-900">
          Welcome{user?.first_name ? `, ${user.first_name}` : ''}
        </h1>
      </div>

      <div className="flex items-center gap-4">
        {user && (
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-gray-900 leading-tight">{fullName}</p>
            <p className="text-xs text-gray-500 leading-tight">{user.email}</p>
          </div>
        )}
        <button
          onClick={logout}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
