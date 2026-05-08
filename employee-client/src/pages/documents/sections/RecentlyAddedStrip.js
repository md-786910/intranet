import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import { formatBytes, pickPrimaryFile } from '../documentActions';
import { useDocumentPreview } from '../DocumentPreviewContext';

// Top-of-page row that always shows the most recently added documents in a
// category — independent of any active filters.
export default function RecentlyAddedStrip({ documents, loading }) {
  const { openDocument } = useDocumentPreview();
  if (loading) {
    return (
      <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
        <h2 className="font-h2 text-h2 text-on-background mb-4">Recently Added</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </section>
    );
  }

  if (!documents || documents.length === 0) return null;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <h2 className="font-h2 text-h2 text-on-background mb-4">Recently Added</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-gutter">
        {documents.map((doc) => {
          const primary = pickPrimaryFile(doc);
          const { icon, color } = iconForFile(primary.name, primary.mime);
          return (
            <button
              key={doc.document_item_id}
              type="button"
              onClick={() => openDocument(doc)}
              className="text-left bg-surface-container-low border border-outline-variant/30 rounded-xl p-unit-md hover:shadow-md hover:border-primary/40 transition-all flex flex-col gap-3 min-h-[8rem] group"
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
                <p className="font-semibold text-on-background truncate">{primary.name || doc.title}</p>
                <p className="font-body-sm text-body-sm text-on-surface-variant mt-1">
                  {formatRelative(doc.published_at || doc.created_at)} · {formatBytes(primary.size)}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
