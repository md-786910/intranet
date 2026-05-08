import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { RECENTLY_VIEWED } from '../data';

export default function RecentlyViewedTable() {
  return (
    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-h2 text-h2 text-on-background">Recently Viewed</h2>
        <button
          type="button"
          className="text-primary font-semibold font-body-sm text-body-sm hover:underline"
        >
          View All
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant/20">
              <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">
                File Name
              </th>
              <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">
                Category
              </th>
              <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">
                Last Viewed
              </th>
              <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant text-right">
                Size
              </th>
            </tr>
          </thead>
          <tbody className="font-body-sm text-body-sm">
            {RECENTLY_VIEWED.map((row, i) => (
              <tr
                key={row.name}
                className={`hover:bg-surface-variant/20 transition-colors ${
                  i < RECENTLY_VIEWED.length - 1
                    ? 'border-b border-outline-variant/10'
                    : ''
                }`}
              >
                <td className="py-4">
                  <div className="flex items-center gap-3">
                    <MaterialIcon name={row.icon} className={row.iconColor} />
                    <span className="font-semibold text-on-background">{row.name}</span>
                  </div>
                </td>
                <td className="py-4 text-on-surface-variant">{row.category}</td>
                <td className="py-4 text-on-surface-variant">{row.time}</td>
                <td className="py-4 text-on-surface-variant text-right">{row.size}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
