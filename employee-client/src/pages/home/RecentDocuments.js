import React, { useEffect, useState } from 'react';
import Skeleton from '../../components/common/Skeleton';
import { documentsService } from '../../services/documentsService';
import { formatRelative } from '../../theme/dateFormat';
import {
  DocumentPreviewProvider,
  useDocumentPreview,
} from '../documents/DocumentPreviewContext';
import { pickPrimaryFile, typeLabelFor } from '../documents/documentActions';
import { useContentRefresh } from '../../contexts/ContentRefreshContext';

const LIMIT = 4;

// File-type badge colours, keyed off the short label `typeLabelFor` returns.
const TYPE_BADGE_COLORS = {
  PDF: 'bg-red-50 text-red-500',
  DOC: 'bg-blue-50 text-blue-500',
  DOCX: 'bg-blue-50 text-blue-500',
  PPT: 'bg-orange-50 text-orange-500',
  PPTX: 'bg-orange-50 text-orange-500',
  XLS: 'bg-green-50 text-green-500',
  XLSX: 'bg-green-50 text-green-500',
  CSV: 'bg-green-50 text-green-500',
  PNG: 'bg-purple-50 text-purple-500',
  JPG: 'bg-purple-50 text-purple-500',
  JPEG: 'bg-purple-50 text-purple-500',
  GIF: 'bg-purple-50 text-purple-500',
  WEBP: 'bg-purple-50 text-purple-500',
  SVG: 'bg-purple-50 text-purple-500',
  MP4: 'bg-pink-50 text-pink-500',
  MOV: 'bg-pink-50 text-pink-500',
  WEBM: 'bg-pink-50 text-pink-500',
  MP3: 'bg-amber-50 text-amber-600',
  WAV: 'bg-amber-50 text-amber-600',
  ZIP: 'bg-amber-50 text-amber-600',
  RAR: 'bg-amber-50 text-amber-600',
  TXT: 'bg-zinc-100 text-zinc-500',
};

function RecentDocsInner() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const { openDocument } = useDocumentPreview();
  const { document } = useContentRefresh();

  useEffect(() => {
    let cancelled = false;
    documentsService
      .listDocuments({ limit: LIMIT, status: 'PUBLISHED', page: 1 })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data?.documents || [];
        setDocs(Array.isArray(list) ? list.slice(0, LIMIT) : []);
      })
      .catch(() => {
        if (!cancelled) setDocs([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [document]);

  return (
    <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col flex-grow">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h3 text-h3">Recent Documents</h3>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : docs.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant px-3 py-4">
          No documents published yet — check back soon.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {docs.map((doc) => {
            const primary = pickPrimaryFile(doc);
            const badge = typeLabelFor(primary.name, primary.mime);
            const color = TYPE_BADGE_COLORS[badge] || 'bg-zinc-100 text-zinc-500';
            return (
              <button
                key={doc.document_item_id}
                type="button"
                onClick={() => openDocument(doc)}
                className="flex items-center gap-4 p-4 border border-zinc-50 rounded-2xl hover:border-primary-container/50 hover:shadow-sm transition-all cursor-pointer bg-white text-left"
              >
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${color}`}
                >
                  {badge}
                </div>
                <div className="overflow-hidden flex-1 min-w-0">
                  <p className="font-semibold text-body-sm truncate">{doc.title}</p>
                  <p className="text-[11px] text-zinc-400">
                    {formatRelative(doc.published_at || doc.created_at)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function RecentDocuments() {
  return (
    <DocumentPreviewProvider>
      <RecentDocsInner />
    </DocumentPreviewProvider>
  );
}
