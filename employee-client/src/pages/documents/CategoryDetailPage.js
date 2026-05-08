import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Skeleton from '../../components/common/Skeleton';
import { documentsService } from '../../services/documentsService';
import { FiltersProvider, useDocumentsFilters } from './FiltersContext';
import { DocumentPreviewProvider } from './DocumentPreviewContext';
import { themeForCategory } from './data';
import FilterPopover from './sections/FilterPopover';
import AllFilesGrid from './sections/AllFilesGrid';

// Inside a single category, search/priority/file-type all apply; category
// chips don't (we're already scoped to this one category).
const DETAIL_PAGE_DIMENSIONS = { search: true, categoryIds: false, priorities: true, fileTypes: true };

// Cap how many docs we slurp for the All Files grid. Each doc can carry
// several files, so 50 docs can easily render ~100 tiles — beyond that we
// rely on the All Documents list with its filter+pagination.
const TOP_DOCS_LIMIT = 50;

function CategoryHero({ category }) {
  const { activeCount } = useDocumentsFilters();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef(null);
  const theme = themeForCategory(category);
  const fileCount = Number(category?.file_count);
  const docCount = Number(category?.doc_count) || 0;
  const chipText = Number.isFinite(fileCount) && fileCount > 0
    ? `${fileCount} ${fileCount === 1 ? 'File' : 'Files'}`
    : `${docCount} ${docCount === 1 ? 'Doc' : 'Docs'}`;

  return (
    <section className="bg-surface-container-lowest border border-outline-variant/30 rounded-2xl p-unit-lg shadow-[0px_4px_20px_rgba(0,0,0,0.04)]">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background font-body-sm text-body-sm transition-colors mb-4"
      >
        <MaterialIcon name="arrow_back" className="text-sm" />
        Resource Library / {category.name}
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4 min-w-0">
          <div
            className={`w-14 h-14 rounded-xl ${theme.iconBg} flex items-center justify-center shrink-0`}
          >
            <MaterialIcon
              name={theme.icon}
              className={theme.iconColor}
              style={{ fontVariationSettings: '"FILL" 1', fontSize: 28 }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="font-h1 text-h1 text-on-background">{category.name}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">
              {category.description || 'Documents in this category.'}
            </p>
            <span
              className={`inline-block mt-3 font-label-caps text-label-caps ${theme.countText} ${theme.countBg} px-2 py-1 rounded`}
            >
              {chipText}
            </span>
          </div>
        </div>

        <div className="relative shrink-0">
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-haspopup="dialog"
            className={`relative flex items-center gap-2 px-unit-lg py-2 border rounded-lg transition-colors font-body-sm text-body-sm ${
              activeCount > 0
                ? 'border-primary bg-primary-container/30 text-on-background'
                : 'border-outline-variant hover:bg-surface-variant'
            }`}
          >
            <MaterialIcon name="filter_list" className="text-sm" />
            Filter
            {activeCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-on-primary font-label-caps text-label-caps">
                {activeCount}
              </span>
            )}
          </button>
          <FilterPopover open={open} onClose={() => setOpen(false)} anchorRef={buttonRef} />
        </div>
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl bg-background">
      <Link
        to="/documents"
        className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-background font-body-sm text-body-sm transition-colors"
      >
        <MaterialIcon name="arrow_back" className="text-sm" />
        Resource Library
      </Link>
      <div className="mt-unit-xl rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-lowest p-unit-xl text-center text-on-surface-variant">
        <MaterialIcon name="folder_off" className="text-outline-variant" style={{ fontSize: 48 }} />
        <p className="font-h3 text-h3 mt-2 text-on-background">Category not available</p>
        <p className="font-body-sm text-body-sm mt-1">
          You don't have access to any documents in this category yet.
        </p>
        <Link to="/documents" className="inline-block mt-4 text-primary font-semibold hover:underline">
          Back to Resource Library
        </Link>
      </div>
    </main>
  );
}

function CategoryDetailInner() {
  const { id } = useParams();
  const categoryId = Number(id);
  const [category, setCategory] = useState(null);
  const [loadingCategory, setLoadingCategory] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [topDocs, setTopDocs] = useState([]);
  const [loadingTopDocs, setLoadingTopDocs] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingCategory(true);
    setNotFound(false);
    documentsService
      .getCategory(categoryId)
      .then((res) => {
        if (cancelled) return;
        setCategory(res.data?.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.response?.status === 404) setNotFound(true);
      })
      .finally(() => { if (!cancelled) setLoadingCategory(false); });
    return () => { cancelled = true; };
  }, [categoryId]);

  // Top docs — feeds the flat All Files grid. Independent of filter state
  // so users always have a complete view at the top of the page.
  useEffect(() => {
    let cancelled = false;
    setLoadingTopDocs(true);
    documentsService
      .listDocuments({ category_id: categoryId, page: 1, limit: TOP_DOCS_LIMIT, status: 'PUBLISHED' })
      .then((res) => {
        if (cancelled) return;
        const list = res.data?.data?.documents || [];
        setTopDocs(Array.isArray(list) ? list : []);
      })
      .catch(() => { if (!cancelled) setTopDocs([]); })
      .finally(() => { if (!cancelled) setLoadingTopDocs(false); });
    return () => { cancelled = true; };
  }, [categoryId]);

  if (notFound) return <NotFound />;

  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl space-y-unit-xl bg-background">
      {loadingCategory || !category ? (
        <Skeleton className="h-40 rounded-2xl" />
      ) : (
        <CategoryHero category={category} />
      )}

      <AllFilesGrid documents={topDocs} loading={loadingTopDocs} />
    </main>
  );
}

export default function CategoryDetailPage() {
  return (
    <FiltersProvider availableDimensions={DETAIL_PAGE_DIMENSIONS}>
      <DocumentPreviewProvider>
        <CategoryDetailInner />
      </DocumentPreviewProvider>
    </FiltersProvider>
  );
}
