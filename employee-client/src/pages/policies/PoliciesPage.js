import React from 'react';

export default function PoliciesPage() {
  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg">
      <h1 className="text-display-sm font-bold mb-6">Company Policies</h1>
      <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm">
        <p className="text-body-lg text-zinc-600">This page will contain all company policies and procedures.</p>
        {/* Policy content will go here */}
      </div>
    </div>
  );
}
