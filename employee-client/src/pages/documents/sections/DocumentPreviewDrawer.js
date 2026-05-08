import React, { useEffect } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import { formatBytes, pickPrimaryFile, typeLabelFor } from '../documentActions';

function PreviewBody({ primary }) {
  if (!primary?.url) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <MaterialIcon name="insert_drive_file" style={{ fontSize: 64 }} />
        <p className="mt-2 font-body text-body">No file attached.</p>
      </div>
    );
  }
  const mime = (primary.mime || '').toLowerCase();
  const name = (primary.name || '').toLowerCase();

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl overflow-hidden">
        <img src={primary.url} alt={primary.name} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  if (mime.startsWith('video/') || /\.(mp4|mov|webm)$/.test(name)) {
    return (
      <video controls src={primary.url} className="w-full h-full bg-black rounded-xl" />
    );
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a)$/.test(name)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl">
        <audio controls src={primary.url} className="w-full px-unit-lg" />
      </div>
    );
  }
  if (mime === 'application/pdf' || /\.pdf$/.test(name)) {
    return (
      <iframe src={primary.url} title={primary.name} className="w-full h-full border-0 rounded-xl bg-white" />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
      <MaterialIcon name="insert_drive_file" style={{ fontSize: 64 }} />
      <p className="mt-2 font-body text-body">Inline preview not available.</p>
      <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
        Use the buttons below to open or download.
      </p>
    </div>
  );
}

export default function DocumentPreviewDrawer({ doc, onClose }) {
  // Lock body scroll while the drawer is open
  useEffect(() => {
    if (!doc) return undefined;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = orig; };
  }, [doc]);

  // ESC closes
  useEffect(() => {
    if (!doc) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [doc, onClose]);

  const open = !!doc;
  const primary = doc ? pickPrimaryFile(doc) : null;
  const { icon, color } = primary
    ? iconForFile(primary.name, primary.mime)
    : { icon: 'description', color: 'text-on-surface-variant' };

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 bg-on-background/40 z-40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Document preview"
        className={`fixed top-0 right-0 h-full w-full sm:w-[560px] max-w-full bg-surface-container-lowest border-l border-outline-variant/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {open && doc && (
          <>
            <header className="flex items-start justify-between gap-4 px-unit-lg py-unit-md border-b border-outline-variant/20">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <MaterialIcon name={icon} className={color} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-background truncate">
                    {primary?.name || doc.title}
                  </p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {doc.category?.name || 'Document'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close preview"
                className="p-2 -m-2 rounded-lg hover:bg-surface-variant/40 transition-colors"
              >
                <MaterialIcon name="close" />
              </button>
            </header>

            <div className="flex-1 min-h-0 p-unit-lg">
              <PreviewBody primary={primary} />
            </div>

            <footer className="border-t border-outline-variant/20 px-unit-lg py-unit-md space-y-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div>
                  <dt className="font-label-caps text-label-caps text-on-surface-variant">Type</dt>
                  <dd className="font-body-sm text-body-sm text-on-background mt-0.5">
                    <span className="font-label-caps text-label-caps bg-surface-container-high px-2 py-0.5 rounded">
                      {typeLabelFor(primary?.name, primary?.mime)}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="font-label-caps text-label-caps text-on-surface-variant">Size</dt>
                  <dd className="font-body-sm text-body-sm text-on-background mt-0.5">
                    {formatBytes(primary?.size)}
                  </dd>
                </div>
                <div>
                  <dt className="font-label-caps text-label-caps text-on-surface-variant">Last Modified</dt>
                  <dd className="font-body-sm text-body-sm text-on-background mt-0.5">
                    {formatRelative(doc.published_at || doc.created_at)}
                  </dd>
                </div>
                {doc.priority && doc.priority !== 'NORMAL' && (
                  <div>
                    <dt className="font-label-caps text-label-caps text-on-surface-variant">Priority</dt>
                    <dd className="font-body-sm text-body-sm text-on-background mt-0.5 capitalize">
                      {String(doc.priority).toLowerCase()}
                    </dd>
                  </div>
                )}
              </dl>
              {doc.summary && (
                <div>
                  <dt className="font-label-caps text-label-caps text-on-surface-variant">Summary</dt>
                  <dd className="font-body-sm text-body-sm text-on-background mt-1 line-clamp-3">
                    {doc.summary}
                  </dd>
                </div>
              )}
              {primary?.url && (
                <div className="flex gap-2 pt-1">
                  <a
                    href={primary.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-unit-lg py-2 bg-primary text-on-primary rounded-lg font-semibold font-body-sm hover:opacity-90 transition-opacity"
                  >
                    <MaterialIcon name="open_in_new" className="text-sm" />
                    Open in new tab
                  </a>
                  <a
                    href={primary.url}
                    download={primary.name || ''}
                    className="flex-1 inline-flex items-center justify-center gap-2 px-unit-lg py-2 border border-outline-variant rounded-lg font-semibold font-body-sm hover:bg-surface-variant transition-colors"
                  >
                    <MaterialIcon name="download" className="text-sm" />
                    Download
                  </a>
                </div>
              )}
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
