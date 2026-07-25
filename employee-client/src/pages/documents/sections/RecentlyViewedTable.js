import React, { useCallback, useEffect, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { documentsService } from '../../../services/documentsService';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import { formatBytes, pickPrimaryFile, resolveAllFiles } from '../documentActions';
import { useDocumentPreview } from '../DocumentPreviewContext';

const PAGE_LIMIT = 4;

export default function RecentlyViewedTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { openDocument } = useDocumentPreview();

  const load = useCallback(async ({ showSkeleton } = { showSkeleton: false }) => {
    if (showSkeleton) setLoading(true);
    setError('');
    try {
      const res = await documentsService.recentlyViewed({ limit: PAGE_LIMIT });
      const list = res.data?.data || [];
      setRows(Array.isArray(list) ? list : []);
    } catch {
      setError('Could not load recent activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load({ showSkeleton: true });
  }, [load]);

  // Refetch after any successful document view (same page or other routes).
  useEffect(() => {
    const onViewed = () => { load({ showSkeleton: false }); };
    window.addEventListener('documents:viewed', onViewed);
    return () => window.removeEventListener('documents:viewed', onViewed);
  }, [load]);

  return (
    <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-h2 text-h2 text-on-background">Recently Viewed</h2>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : error ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">{error}</p>
      ) : rows.length === 0 ? (
        <div className="text-center py-unit-xl text-on-surface-variant">
          <MaterialIcon name="history" className="text-outline-variant" style={{ fontSize: 36 }} />
          <p className="font-body-sm text-body-sm mt-2">Nothing viewed yet — open a document to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">File Name</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">Category</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">Last Viewed</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant text-right">Size</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm">
              {rows.map((row, i) => {
                const doc = row.document || {};
                const primary = pickPrimaryFile(doc);
                const extra = Math.max(0, resolveAllFiles(doc).length - 1);
                const { icon, color } = iconForFile(primary.name, primary.mime);
                return (
                  <tr
                    key={row.view_id || `${doc.document_item_id}-${row.viewed_at}`}
                    onClick={() => openDocument(doc)}
                    className={`hover:bg-surface-variant/20 transition-colors cursor-pointer ${
                      i < rows.length - 1 ? 'border-b border-outline-variant/10' : ''
                    }`}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <MaterialIcon name={icon} className={color} />
                        <span className="font-semibold text-on-background">
                          {primary.name || doc.title}
                          {extra > 0 && (
                            <span className="ml-2 inline-block font-label-caps text-label-caps bg-surface-container-high text-on-surface-variant px-1.5 py-0.5 rounded align-middle">
                              +{extra} more
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 text-on-surface-variant">{doc.category?.name || '—'}</td>
                    <td className="py-4 text-on-surface-variant">{formatRelative(row.viewed_at)}</td>
                    <td className="py-4 text-on-surface-variant text-right">{formatBytes(primary.size)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
