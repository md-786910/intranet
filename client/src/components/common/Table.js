import React from 'react';

export default function Table({
  columns = [], data = [], loading, emptyMessage = 'No data found',
  sortBy, sortOrder, onSort, onRowClick, getRowClassName,
}) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-100 rounded" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map((col) => {
                const isActive = col.sortable && sortBy === col.key;
                return (
                  <th
                    key={col.key}
                    className={`px-4 py-3 text-left font-medium select-none transition-colors ${
                      col.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
                    } ${isActive ? 'text-primary-700 bg-gray-100' : 'text-gray-600'}`}
                    onClick={col.sortable && onSort ? () => onSort(col.key) : undefined}
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{col.label}</span>
                      {col.sortable && (
                        isActive ? (
                          <svg className="w-3.5 h-3.5 text-primary-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round"
                              d={sortOrder === 'asc' ? 'M5 15l7-7 7 7' : 'M19 9l-7 7-7-7'} />
                          </svg>
                        ) : (
                          <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4M8 15l4 4 4-4" />
                          </svg>
                        )
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-12 text-center text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => {
                const accent = getRowClassName ? getRowClassName(row) : '';
                return (
                  <tr
                    key={row.id || idx}
                    className={`hover:bg-gray-50 transition-colors ${onRowClick ? 'cursor-pointer' : ''}`}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                  >
                    {columns.map((col, colIdx) => (
                      <td
                        key={col.key}
                        className={`px-4 py-3 text-gray-700 ${colIdx === 0 && accent ? accent : ''}`}
                      >
                        {col.render ? col.render(row) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
