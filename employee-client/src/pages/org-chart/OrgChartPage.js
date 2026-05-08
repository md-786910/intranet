import React from 'react';

export default function OrgChartPage() {
  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-unit-lg">
      <h1 className="text-display-sm font-bold mb-6">Organisation Chart</h1>
      <div className="bg-white rounded-2xl p-8 border border-zinc-100 shadow-sm">
        <p className="text-body-lg text-zinc-600">This page will display the company's organisational structure.</p>
        {/* Org chart visualization will go here */}
      </div>
    </div>
  );
}
