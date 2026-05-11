import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Skeleton from '../../components/common/Skeleton';
import { newsService } from '../../services/newsService';
import { documentsService } from '../../services/documentsService';
import { formatRelative } from '../../theme/dateFormat';
import { categoryPalette } from '../../theme/categoryColors';
import {
  DocumentPreviewProvider,
  useDocumentPreview,
} from '../documents/DocumentPreviewContext';
import { pickPrimaryFile, typeLabelFor } from '../documents/documentActions';
import { iconFor } from './newsIcon';

const FETCH_LIMIT = 20;

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

function isToday(iso) {
  if (!iso) return false;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

function TodayCardInner() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const { openDocument } = useDocumentPreview();

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      newsService.getArticles({ status: 'PUBLISHED', page: 1, limit: FETCH_LIMIT }),
      documentsService.listDocuments({ status: 'PUBLISHED', page: 1, limit: FETCH_LIMIT }),
    ]).then((results) => {
      if (cancelled) return;

      const newsRes = results[0].status === 'fulfilled' ? results[0].value : null;
      const docsRes = results[1].status === 'fulfilled' ? results[1].value : null;

      const articles = newsRes?.data?.data?.articles || [];
      const docs = docsRes?.data?.data?.documents || [];

      const newsToday = articles
        .filter((a) => isToday(a.published_at || a.created_at))
        .map((a) => ({
          kind: 'news',
          id: `news-${a.news_item_id}`,
          ts: a.published_at || a.created_at,
          data: a,
        }));

      const docsToday = docs
        .filter((d) => isToday(d.published_at || d.created_at))
        .map((d) => ({
          kind: 'document',
          id: `doc-${d.document_item_id}`,
          ts: d.published_at || d.created_at,
          data: d,
        }));

      const merged = [...newsToday, ...docsToday].sort(
        (a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime(),
      );

      setItems(merged);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="lg:col-span-4 bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
      <div className="mb-unit-md">
        <span className="font-label-caps text-on-surface-variant uppercase">
          TODAY
        </span>
      </div>

      {loading ? (
        <LoadingState />
      ) : items.length === 0 ? (
        <EmptyState />
      ) : (
        <ul
          className="space-y-6 overflow-y-auto pr-1"
          style={{ maxHeight: 320 }}
        >
          {items.map((item) =>
            item.kind === 'news' ? (
              <NewsRow key={item.id} article={item.data} />
            ) : (
              <DocumentRow
                key={item.id}
                doc={item.data}
                onOpen={openDocument}
              />
            ),
          )}
        </ul>
      )}
    </div>
  );
}

function NewsRow({ article }) {
  const categoryName = article.category?.name;
  const palette = categoryPalette(categoryName);
  const time = article.published_at || article.created_at;
  const subtitleLabel = categoryName || 'News';

  return (
    <li>
      <Link
        to={`/news/${article.news_item_id}`}
        className="flex items-start gap-4 group"
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${palette.bg} ${palette.text}`}
        >
          <MaterialIcon name={iconFor(article)} />
        </div>
        <div className="min-w-0">
          <p className="font-body-md font-semibold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
            {article.title}
          </p>
          <p className="text-body-sm text-on-surface-variant line-clamp-1">
            {subtitleLabel} · {formatRelative(time)}
          </p>
        </div>
      </Link>
    </li>
  );
}

function DocumentRow({ doc, onOpen }) {
  const primary = pickPrimaryFile(doc);
  const badge = typeLabelFor(primary.name, primary.mime);
  const color = TYPE_BADGE_COLORS[badge] || 'bg-zinc-100 text-zinc-500';
  const categoryName = doc.category?.name;
  const time = doc.published_at || doc.created_at;
  const subtitleLabel = categoryName || badge;

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(doc)}
        className="flex items-start gap-4 w-full text-left group"
      >
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[10px] shrink-0 ${color}`}
        >
          {badge}
        </div>
        <div className="min-w-0">
          <p className="font-body-md font-semibold text-on-surface line-clamp-1 group-hover:text-primary transition-colors">
            {doc.title}
          </p>
          <p className="text-body-sm text-on-surface-variant line-clamp-1">
            {subtitleLabel} · {formatRelative(time)}
          </p>
        </div>
      </button>
    </li>
  );
}

function LoadingState() {
  return (
    <ul className="space-y-6">
      {[0, 1, 2].map((i) => (
        <li key={i} className="flex items-start gap-4">
          <Skeleton className="w-10 h-10 rounded-lg shrink-0" />
          <div className="flex-grow space-y-2">
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-1/2 rounded" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center text-center py-unit-lg">
      <MaterialIcon
        name="event_available"
        className="text-outline-variant text-5xl mb-unit-xs"
      />
      <p className="font-body-sm text-on-surface-variant">
        Nothing new today — enjoy the calm.
      </p>
    </div>
  );
}

export default function TodayCard() {
  return (
    <DocumentPreviewProvider>
      <TodayCardInner />
    </DocumentPreviewProvider>
  );
}
