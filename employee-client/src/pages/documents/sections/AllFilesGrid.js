import React, { useMemo } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import {
  formatBytes,
  mimePrefixesForFileTypes,
  resolveAllFiles,
} from '../documentActions';
import { useDocumentPreview } from '../DocumentPreviewContext';
import { useDocumentsFilters } from '../FiltersContext';

// Flat view of every file attached to every visible document in the
// category, sorted newest first. Tiles open the preview drawer pointed at
// the specific file the user clicked.
export default function AllFilesGrid({ documents, loading }) {
  const { openDocument } = useDocumentPreview();
  const { filters } = useDocumentsFilters();

  const tiles = useMemo(() => {
    if (!documents) return [];
    const term = (filters.search || '').trim().toLowerCase();
    const wantedPriorities = new Set(filters.priorities || []);
    const wantedMimes = mimePrefixesForFileTypes(filters.fileTypes || []);

    const out = [];
    for (const doc of documents) {
      // Priority is per-doc.
      if (wantedPriorities.size > 0 && !wantedPriorities.has(doc.priority)) continue;
      const files = resolveAllFiles(doc);
      files.forEach((file, fileIndex) => {
        // File-type chips look at each file's mime.
        if (wantedMimes.length > 0) {
          const mime = (file.mime || '').toLowerCase();
          if (!mime || !wantedMimes.some((p) => mime.startsWith(p))) return;
        }
        // Search matches file name OR parent doc title.
        if (term) {
          const summaryText = String(doc.summary || '').replace(/<[^>]*>/g, ' ');
          const haystack = `${file.name || ''} ${doc.title || ''} ${summaryText}`.toLowerCase();
          if (!haystack.includes(term)) return;
        }
        out.push({
          file,
          fileIndex,
          doc,
          publishedAt: doc.published_at || doc.created_at,
        });
      });
    }
    out.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    return out;
  }, [documents, filters]);

  if (loading) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
        <h2 className="font-h2 text-h2 text-on-background mb-4">All Files</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </section>
    );
  }

  if (tiles.length === 0) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
        <h2 className="font-h2 text-h2 text-on-background mb-4">All Files</h2>
        <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-unit-xl text-center text-on-surface-variant">
          <MaterialIcon name="folder_off" className="text-outline-variant" style={{ fontSize: 36 }} />
          <p className="font-body text-body mt-2">No files match your filters.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-baseline justify-between mb-4">
        <h2 className="font-h2 text-h2 text-on-background">All Files</h2>
        <span className="font-body-sm text-body-sm text-on-surface-variant">{tiles.length} files</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-gutter">
        {tiles.map(({ file, fileIndex, doc, publishedAt }) => {
          const { icon, color } = iconForFile(file.name, file.mime);
          return (
            <button
              key={`${doc.document_item_id}-${fileIndex}`}
              type="button"
              onClick={() => openDocument(doc, { fileIndex })}
              className="text-left bg-surface-container-low border border-outline-variant/30 rounded-xl p-unit-md hover:shadow-md hover:border-primary/40 transition-all flex flex-col gap-3 min-h-[8rem] group"
              title={file.name}
            >
              <div className="flex items-start justify-between">
                <div className="w-11 h-11 rounded-lg bg-surface-container-high flex items-center justify-center shrink-0">
                  <MaterialIcon name={icon} className={color} style={{ fontSize: 24 }} />
                </div>
                <MaterialIcon
                  name="north_east"
                  className="text-outline-variant group-hover:text-primary transition-colors"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-on-background truncate">{file.name}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant truncate mt-0.5">
                  {doc.title}
                </p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {formatRelative(publishedAt)} · {formatBytes(file.size)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
