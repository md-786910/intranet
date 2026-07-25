import React, { useEffect, useState } from 'react';
import Skeleton from '../../../components/common/Skeleton';
import { plainTextFromHtml } from '../../../components/common/RichTextView';
import { documentsService } from '../../../services/documentsService';
import { useDocumentPreview } from '../DocumentPreviewContext';

export default function FeaturedBanner() {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const { openDocument } = useDocumentPreview();

  useEffect(() => {
    let cancelled = false;
    documentsService
      .featured()
      .then((res) => {
        if (cancelled) return;
        setDoc(res.data?.data || null);
      })
      .catch(() => {
        if (!cancelled) setDoc(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <Skeleton className="h-[400px] rounded-[32px]" />;
  if (!doc) return null;

  const pill = doc.priority === 'URGENT' ? 'Urgent' : 'Featured';
  const primary = (doc.versions && doc.versions[0]) || null;
  const summaryText = plainTextFromHtml(doc.summary);

  return (
    <section className="relative h-[400px] rounded-[32px] overflow-hidden bg-gradient-to-br from-primary via-tertiary to-secondary">
      <div className="absolute inset-0 bg-gradient-to-r from-on-background/80 via-on-background/40 to-transparent flex flex-col justify-center px-6 sm:px-12 text-white">
        <span className="bg-primary-container text-on-primary-container font-label-caps text-label-caps px-3 py-1.5 rounded-full w-fit mb-6">
          {pill.toUpperCase()}
        </span>
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-display text-white mb-4 max-w-xl">
          {doc.title}
        </h2>
        {summaryText && (
          <p className="font-body-lg text-body-lg text-white/80 max-w-md mb-8 line-clamp-3">
            {summaryText}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={() => openDocument(doc)}
            disabled={!primary?.file_url}
            className="bg-white text-on-background px-unit-lg py-3 rounded-xl font-bold hover:bg-surface-variant transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {primary?.file_url ? 'Open Document' : 'No File Attached'}
          </button>
          {doc.category?.name && (
            <span className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-unit-lg py-3 rounded-xl font-semibold">
              {doc.category.name}
            </span>
          )}
        </div>
      </div>
    </section>
  );
}
