import React, { useEffect, useState } from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import Skeleton from '../../../components/common/Skeleton';
import { documentsService } from '../../../services/documentsService';
import { formatRelative } from '../../../theme/dateFormat';
import { iconForFile } from '../data';
import { useDocumentsFilters } from '../FiltersContext';
import {
  formatBytes,
  mimePrefixesForFileTypes,
  pickPrimaryFile,
  typeLabelFor,
} from '../documentActions';
import { useDocumentPreview } from '../DocumentPreviewContext';

const PAGE_SIZE = 20;

function buildParams(categoryId, filters, page) {
  const params = {
    category_id: categoryId,
    page,
    limit: PAGE_SIZE,
    status: 'PUBLISHED',
  };
  if (filters.search) params.search = filters.search;
  if (filters.priorities.length > 0) params.priority = filters.priorities.join(',');
  const mimes = mimePrefixesForFileTypes(filters.fileTypes);
  if (mimes.length > 0) params.mime_prefix = mimes;
  return params;
}

export default function CategoryDocList({ categoryId }) {
  const { filters } = useDocumentsFilters();
  const { openDocument } = useDocumentPreview();
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Refetch from page 1 whenever filters change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setPage(1);

    documentsService
      .listDocuments(buildParams(categoryId, filters, 1))
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || {};
        setDocs(Array.isArray(data.documents) ? data.documents : []);
        setPagination(data.pagination || null);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load documents.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [categoryId, filters]);

  const loadMore = () => {
    if (loadingMore) return;
    setLoadingMore(true);
    const next = page + 1;
    documentsService
      .listDocuments(buildParams(categoryId, filters, next))
      .then((res) => {
        const data = res.data?.data || {};
        setDocs((prev) => [...prev, ...(Array.isArray(data.documents) ? data.documents : [])]);
        setPagination(data.pagination || null);
        setPage(next);
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false));
  };

  const hasMore = pagination ? Boolean(pagination.hasNextPage) : false;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <div className="flex items-baseline justify-between mb-6">
        <h2 className="font-h2 text-h2 text-on-background">All Documents</h2>
        {pagination?.total != null && (
          <span className="font-body-sm text-body-sm text-on-surface-variant">
            {pagination.total} total
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-12" />)}
        </div>
      ) : error ? (
        <p className="text-on-surface-variant font-body-sm text-body-sm">{error}</p>
      ) : docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low p-unit-xl text-center text-on-surface-variant">
          <MaterialIcon name="folder_off" className="text-outline-variant" style={{ fontSize: 36 }} />
          <p className="font-body text-body mt-2">No documents match your filters.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-outline-variant/20">
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">File Name</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">Type</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant">Last Modified</th>
                <th className="pb-4 font-label-caps text-label-caps text-on-surface-variant text-right">Size</th>
              </tr>
            </thead>
            <tbody className="font-body-sm text-body-sm">
              {docs.map((doc, i) => {
                const primary = pickPrimaryFile(doc);
                const { icon, color } = iconForFile(primary.name, primary.mime);
                return (
                  <tr
                    key={doc.document_item_id}
                    onClick={() => openDocument(doc)}
                    className={`hover:bg-surface-variant/20 transition-colors cursor-pointer ${
                      i < docs.length - 1 ? 'border-b border-outline-variant/10' : ''
                    }`}
                  >
                    <td className="py-4 pr-4 max-w-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <MaterialIcon name={icon} className={color} />
                        <div className="min-w-0">
                          <p className="font-semibold text-on-background truncate">
                            {primary.name || doc.title}
                          </p>
                          {doc.summary && (
                            <p className="font-body-sm text-body-sm text-on-surface-variant truncate">
                              {doc.summary}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 pr-4 text-on-surface-variant">
                      <span className="font-label-caps text-label-caps bg-surface-container-high px-2 py-1 rounded">
                        {typeLabelFor(primary.name, primary.mime)}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-on-surface-variant whitespace-nowrap">
                      {formatRelative(doc.published_at || doc.created_at)}
                    </td>
                    <td className="py-4 text-on-surface-variant text-right whitespace-nowrap">
                      {formatBytes(primary.size)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasMore && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="px-unit-lg py-2 border border-outline-variant rounded-lg hover:bg-surface-variant transition-colors font-body-sm text-body-sm disabled:opacity-60"
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </section>
  );
}
