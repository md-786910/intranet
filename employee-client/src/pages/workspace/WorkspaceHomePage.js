import React from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function WorkspaceHomePage() {
  const { user } = useAuth();
  const firstName = user?.first_name || 'there';

  return (
    <div className="px-8 py-10 max-w-4xl">
      <div className="bg-white border border-gray-200 rounded-2xl px-8 py-10 shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900">Hello, {firstName}</h2>
        <p className="mt-2 text-gray-600">Your workspace is being assembled.</p>
        <p className="mt-6 text-sm text-gray-500">
          News, documents, and your team directory will appear here soon.
        </p>
      </div>
    </div>
  );
}
