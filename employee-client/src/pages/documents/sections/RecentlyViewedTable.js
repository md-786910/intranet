import React, { useEffect, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { documentsService } from '../../../services/documentsService';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';

const PAGE_LIMIT = 4;

function formatBytes(n) {
  if (n == null || isNaN(n)) return '—';
  const bytes = Number(n);
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  return `${(mb / 1024).toFixed(2)} GB`;
}

function pickPrimaryFile(doc) {
  const versions = doc.versions || [];
  const v0 = versions[0] || null;
  if (v0) {
    return {
      name: v0.file_name,
      mime: v0.mime_type,
      size: v0.file_size,
      url: v0.file_url,
    };
  }
  return { name: doc.title, mime: '', size: null, url: null };
}

export default function RecentlyViewedTable() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    documentsService
      .recentlyViewed({ limit: PAGE_LIMIT })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data || [];
        setRows(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load recent activity.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openDoc = (doc, primary) => {
    if (doc?.document_item_id) {
      // Bump the view timestamp; ignore failures (server enforces visibility).
      documentsService.recordView(doc.document_item_id).catch(() => {});
    }
    if (primary?.url) window.open(primary.url, '_blank', 'noopener');
  };

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
                const { icon, color } = iconForFile(primary.name, primary.mime);
                return (
                  <tr
                    key={row.view_id}
                    onClick={() => openDoc(doc, primary)}
                    className={`hover:bg-surface-variant/20 transition-colors cursor-pointer ${
                      i < rows.length - 1 ? 'border-b border-outline-variant/10' : ''
                    }`}
                  >
                    <td className="py-4">
                      <div className="flex items-center gap-3">
                        <MaterialIcon name={icon} className={color} />
                        <span className="font-semibold text-on-background">
                          {primary.name || doc.title}
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
