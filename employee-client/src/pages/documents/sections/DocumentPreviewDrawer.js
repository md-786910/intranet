import React, { useEffect, useMemo, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import RichTextView from '../../../components/common/RichTextView';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import { formatBytes, resolveAllFiles, typeLabelFor } from '../documentActions';

function PreviewBody({ file }) {
  if (!file?.url) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-on-surface-variant">
        <MaterialIcon name="insert_drive_file" style={{ fontSize: 64 }} />
        <p className="mt-2 font-body text-body">No file attached.</p>
      </div>
    );
  }
  const mime = (file.mime || '').toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|heif|avif)$/.test(name)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl overflow-hidden">
        <img src={file.url} alt={file.name} className="max-w-full max-h-full object-contain" />
      </div>
    );
  }
  if (mime.startsWith('video/') || /\.(mp4|mov|webm|avi|mkv)$/.test(name)) {
    return <video controls src={file.url} className="w-full h-full bg-black rounded-xl" />;
  }
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg)$/.test(name)) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-surface-container-low rounded-xl">
        <audio controls src={file.url} className="w-full px-unit-lg" />
      </div>
    );
  }
  if (mime === 'application/pdf' || /\.pdf$/.test(name)) {
    return <iframe src={file.url} title={file.name} className="w-full h-full border-0 rounded-xl bg-white" />;
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

function FileTab({ file, active, onClick }) {
  const { icon, color } = iconForFile(file.name, file.mime);
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border whitespace-nowrap transition-colors ${
        active
          ? 'bg-primary-container/40 border-primary text-on-background'
          : 'bg-surface-container-lowest border-outline-variant/40 text-on-surface-variant hover:bg-surface-variant/40'
      }`}
      title={file.name}
    >
      <MaterialIcon name={icon} className={`${color} text-sm`} />
      <span className="font-body-sm text-body-sm max-w-[160px] truncate">{file.name}</span>
    </button>
  );
}

export default function DocumentPreviewDrawer({ doc, initialFileIndex = 0, onClose }) {
  const files = useMemo(() => (doc ? resolveAllFiles(doc) : []), [doc]);
  const [activeIdx, setActiveIdx] = useState(initialFileIndex);

  // Sync to the index requested when the doc changes (e.g. opened from the
  // All Files grid pointing at a non-first file).
  useEffect(() => {
    const safe = Math.min(Math.max(0, initialFileIndex || 0), Math.max(0, files.length - 1));
    setActiveIdx(safe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc?.document_item_id, initialFileIndex]);

  // Lock body scroll while open
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
  const active = files[activeIdx] || null;
  const headIcon = active ? iconForFile(active.name, active.mime) : { icon: 'description', color: 'text-on-surface-variant' };

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
        className={`fixed top-0 right-0 h-full w-full sm:w-[600px] max-w-full bg-surface-container-lowest border-l border-outline-variant/30 shadow-2xl z-50 flex flex-col transform transition-transform duration-200 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {open && doc && (
          <>
            <header className="flex items-start justify-between gap-4 px-unit-lg py-unit-md border-b border-outline-variant/20">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <MaterialIcon name={headIcon.icon} className={headIcon.color} />
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-on-background truncate">{doc.title}</p>
                  <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                    {doc.category?.name || 'Document'}
                    {files.length > 1 && (
                      <span className="ml-2 inline-block font-label-caps text-label-caps bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded">
                        {files.length} files
                      </span>
                    )}
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

            {files.length > 1 && (
              <div className="px-unit-lg pt-unit-md shrink-0">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {files.map((f, i) => (
                    <FileTab key={`${f.url}-${i}`} file={f} active={i === activeIdx} onClick={() => setActiveIdx(i)} />
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 min-h-[160px] max-h-[42vh] p-unit-lg shrink-0">
              <PreviewBody file={active} />
            </div>

            <footer className="border-t border-outline-variant/20 flex-1 min-h-0 flex flex-col">
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-unit-lg py-unit-md space-y-4">
                <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <div>
                    <dt className="font-label-caps text-label-caps text-on-surface-variant">Type</dt>
                    <dd className="font-body-sm text-body-sm text-on-background mt-0.5">
                      <span className="font-label-caps text-label-caps bg-surface-container-high px-2 py-0.5 rounded">
                        {typeLabelFor(active?.name, active?.mime)}
                      </span>
                    </dd>
                  </div>
                  <div>
                    <dt className="font-label-caps text-label-caps text-on-surface-variant">Size</dt>
                    <dd className="font-body-sm text-body-sm text-on-background mt-0.5">
                      {formatBytes(active?.size)}
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
                    <dd className="font-body-sm text-body-sm text-on-background mt-1">
                      <RichTextView html={doc.summary} className="prose prose-sm max-w-none" />
                    </dd>
                  </div>
                )}
              </div>
              {active?.url && (
                <div className="shrink-0 border-t border-outline-variant/20 px-unit-lg py-unit-md flex gap-2 bg-surface-container-lowest">
                  <a
                    href={active.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-unit-lg py-2 bg-primary text-on-primary rounded-lg font-semibold font-body-sm hover:opacity-90 transition-opacity"
                  >
                    <MaterialIcon name="open_in_new" className="text-sm" />
                    Open in new tab
                  </a>
                  <a
                    href={active.url}
                    download={active.name || ''}
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
