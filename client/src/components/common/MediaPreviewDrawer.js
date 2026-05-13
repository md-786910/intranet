import React, { useEffect, useState } from 'react';
import { formatFileSize } from '../../utils/formatters';
import { resolveAssetUrl } from '../../utils/mediaUrl';
import MediaTypeIcon, { getMediaKind } from './MediaTypeIcon';
import Button from './Button';
import ActivityTimeline from './ActivityTimeline';
import { mediaEvents } from '../../utils/activityEvents';

export default function MediaPreviewDrawer({
  asset, open, onClose, onDelete, canDelete, onRestore, canRestore,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setCopied(false);
  }, [open, asset?.media_asset_id]);

  const url = asset ? resolveAssetUrl(asset.url) : null;
  const kind = getMediaKind(asset?.mime_type);

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard rejected — silent */
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />
      <aside
        className={`fixed top-0 right-0 h-full w-full max-w-xl bg-white shadow-xl z-50 flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-label="Media preview"
      >
        <div className="flex items-start justify-between px-5 py-4 border-b border-gray-200">
          <div className="min-w-0 pr-3">
            <div className="text-sm text-gray-500">Preview</div>
            <div className="font-semibold text-gray-900 truncate" title={asset?.original_name}>
              {asset?.original_name || '—'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 -mr-1"
            aria-label="Close preview"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50">
          {asset ? (
            <PreviewBody asset={asset} url={url} kind={kind} />
          ) : (
            <div className="p-8 text-center text-gray-500">No item selected</div>
          )}
        </div>

        {asset && (
          <div className="border-t border-gray-200 bg-white">
            <dl className="px-5 py-4 grid grid-cols-3 gap-y-3 text-sm">
              <dt className="text-gray-500">Type</dt>
              <dd className="col-span-2 text-gray-900">{asset.mime_type || '—'}</dd>
              <dt className="text-gray-500">Size</dt>
              <dd className="col-span-2 text-gray-900">{formatFileSize(asset.size_bytes)}</dd>
            </dl>
            <div className="px-5 pb-4">
              <h4 className="text-xs font-medium uppercase tracking-wide text-gray-500 mb-3">Activity</h4>
              {/* Drawer body already scrolls; let the timeline grow naturally. */}
              <ActivityTimeline events={mediaEvents(asset)} scrollable={false} />
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-2">
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
              >
                Open in new tab
              </a>
              <Button variant="secondary" size="md" onClick={handleCopy}>
                {copied ? 'Copied' : 'Copy URL'}
              </Button>
              <div className="ml-auto">
                {canRestore && onRestore && (
                  <Button variant="primary" size="md" onClick={() => onRestore(asset)}>
                    Restore
                  </Button>
                )}
                {canDelete && onDelete && (
                  <Button variant="danger" size="md" onClick={() => onDelete(asset)}>
                    Move to trash
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}

function PreviewBody({ asset, url, kind }) {
  if (kind === 'image') {
    return (
      <div className="p-5 flex items-center justify-center">
        <img
          src={url}
          alt={asset.alt_text || asset.original_name}
          className="max-w-full max-h-[70vh] rounded-lg shadow-sm bg-white"
        />
      </div>
    );
  }
  if (kind === 'pdf') {
    return (
      <div className="h-full">
        <iframe
          title={asset.original_name}
          src={url}
          className="w-full h-full min-h-[60vh] border-0 bg-white"
        />
      </div>
    );
  }
  if (kind === 'text' || kind === 'csv') {
    return (
      <div className="h-full">
        <iframe
          title={asset.original_name}
          src={url}
          className="w-full h-full min-h-[60vh] border-0 bg-white"
        />
      </div>
    );
  }
  return (
    <div className="p-8 flex flex-col items-center justify-center text-center">
      <MediaTypeIcon mime={asset.mime_type} size="lg" />
      <div className="mt-4 text-sm text-gray-700 font-medium">{asset.original_name}</div>
      <div className="mt-1 text-xs text-gray-500">
        Inline preview is not available for this file type.
      </div>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700"
      >
        Download / open
      </a>
    </div>
  );
}
