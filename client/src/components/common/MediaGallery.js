import React, { useState } from 'react';
import { formatFileSize, formatDateTime } from '../../utils/formatters';
import { resolveAssetUrl } from '../../utils/mediaUrl';
import MediaTypeIcon, { getMediaKind } from './MediaTypeIcon';

function ThumbCell({ asset }) {
  const [errored, setErrored] = useState(false);
  const isImage = getMediaKind(asset.mime_type) === 'image';
  if (isImage && !errored) {
    return (
      <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
        <img
          src={resolveAssetUrl(asset.url)}
          alt={asset.alt_text || asset.original_name}
          className="w-full h-full object-cover"
          onError={() => setErrored(true)}
        />
      </div>
    );
  }
  return <MediaTypeIcon mime={asset.mime_type} size="md" />;
}

function MimeChip({ mime }) {
  if (!mime) return <span className="text-gray-400">—</span>;
  const short = mime.split('/').pop().toUpperCase();
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
      {short}
    </span>
  );
}

export default function MediaGallery({
  assets = [],
  loading,
  selectionMode = 'none',
  selectedIds = [],
  onSelectionChange,
  onDelete,
  onRestore,
  onPurge,
  onRowClick,
  selectionLimit,
  emptyMessage = 'No media yet',
}) {
  const showSelect = selectionMode !== 'none';
  const allSelected = showSelect && assets.length > 0 && assets.every((a) => selectedIds.includes(a.media_asset_id));
  const isInteractive = showSelect || Boolean(onRowClick);
  const showActionCol = Boolean(onDelete || onRestore || onPurge);

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([]);
      return;
    }
    const ids = assets.map((a) => a.media_asset_id);
    if (selectionLimit && ids.length > selectionLimit) {
      onSelectionChange(ids.slice(0, selectionLimit));
    } else {
      onSelectionChange(ids);
    }
  };

  const toggleOne = (id) => {
    if (!onSelectionChange) return;
    if (selectionMode === 'single') {
      onSelectionChange(selectedIds.includes(id) ? [] : [id]);
      return;
    }
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((sid) => sid !== id));
    } else {
      if (selectionLimit && selectedIds.length >= selectionLimit) return;
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="animate-pulse p-4 space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-14 bg-gray-100 rounded" />
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
            <tr className="bg-gray-50 border-b border-gray-200 text-left">
              {showSelect && selectionMode === 'multi' && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                </th>
              )}
              {showSelect && selectionMode === 'single' && <th className="w-10 px-4 py-3" />}
              <th className="w-16 px-4 py-3" />
              <th className="px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="px-4 py-3 font-medium text-gray-600">Type</th>
              <th className="px-4 py-3 font-medium text-gray-600">Size</th>
              <th className="px-4 py-3 font-medium text-gray-600">Uploaded by</th>
              <th className="px-4 py-3 font-medium text-gray-600">Uploaded</th>
              {showActionCol && <th className="w-20 px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {assets.length === 0 ? (
              <tr>
                <td
                  colSpan={6 + (showSelect ? 1 : 0) + (showActionCol ? 1 : 0)}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              assets.map((asset) => {
                const checked = selectedIds.includes(asset.media_asset_id);
                const handleRowClick = () => {
                  if (onRowClick) onRowClick(asset);
                  else if (showSelect) toggleOne(asset.media_asset_id);
                };
                return (
                  <tr
                    key={asset.media_asset_id}
                    className={`hover:bg-gray-50 transition-colors ${checked ? 'bg-primary-50/40' : ''} ${isInteractive ? 'cursor-pointer' : ''}`}
                    onClick={isInteractive ? handleRowClick : undefined}
                  >
                    {showSelect && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type={selectionMode === 'single' ? 'radio' : 'checkbox'}
                          checked={checked}
                          onChange={() => toggleOne(asset.media_asset_id)}
                          className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <ThumbCell asset={asset} />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {asset.original_name}
                      </span>
                    </td>
                    <td className="px-4 py-3"><MimeChip mime={asset.mime_type} /></td>
                    <td className="px-4 py-3 text-gray-600">{formatFileSize(asset.size_bytes)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {asset.uploader ? `${asset.uploader.first_name} ${asset.uploader.last_name}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDateTime(asset.created_at)}</td>
                    {showActionCol && (
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end gap-3">
                          {onRestore && (
                            <button
                              type="button"
                              onClick={() => onRestore([asset.media_asset_id])}
                              className="text-primary-600 hover:text-primary-700 text-xs font-medium"
                            >
                              Restore
                            </button>
                          )}
                          {onPurge && (
                            <button
                              type="button"
                              onClick={() => onPurge([asset.media_asset_id])}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Delete forever
                            </button>
                          )}
                          {!onRestore && !onPurge && onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete([asset.media_asset_id])}
                              className="text-red-600 hover:text-red-700 text-xs font-medium"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    )}
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
