import React, { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import ResourceLibraryHeader from "./sections/ResourceLibraryHeader";
import CategoryGrid from "./sections/CategoryGrid";
import RecentlyViewedTable from "./sections/RecentlyViewedTable";
import ResourceStatsCard from "./sections/ResourceStatsCard";
import FeaturedBanner from "./sections/FeaturedBanner";
import { FiltersProvider } from "./FiltersContext";
import { DocumentPreviewProvider, useDocumentPreview } from "./DocumentPreviewContext";
import useCategories from "./useCategories";
import { documentsService } from "../../services/documentsService";

// Category cards on the main page only support search + category-chip
// filtering; priority/file-type apply to documents inside a category, not
// to the cards themselves.
const MAIN_PAGE_DIMENSIONS = {
  search: true,
  categoryIds: true,
  priorities: false,
  fileTypes: false,
};

// When the user clicks a DOCUMENT notification from the bell, the deeplink is
// /documents?preview=<id>. This hook reads the param, fetches that single
// document, opens the preview drawer, then strips the param from the URL so
// the back button feels natural.
function usePreviewQueryParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { openDocument } = useDocumentPreview();
  const previewId = searchParams.get("preview");

  useEffect(() => {
    if (!previewId) return undefined;
    let cancelled = false;
    documentsService
      .getDocument(previewId)
      .then((res) => {
        if (cancelled) return;
        const doc = res.data?.data;
        if (doc) openDocument(doc);
      })
      .catch(() => {
        /* silent — the page still renders normally */
      })
      .finally(() => {
        if (cancelled) return;
        // Clean the URL so a refresh doesn't keep re-opening the drawer.
        const next = new URLSearchParams(searchParams);
        next.delete("preview");
        setSearchParams(next, { replace: true });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewId]);
}

function DocumentsPageInner() {
  const { categories, loading, error } = useCategories();
  usePreviewQueryParam();

  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl space-y-unit-xl bg-background">
      <ResourceLibraryHeader categories={categories} />
      <CategoryGrid categories={categories} loading={loading} error={error} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <RecentlyViewedTable />
        <div className="space-y-gutter">
          <ResourceStatsCard categories={categories} />
        </div>
      </div>
      <FeaturedBanner />
    </main>
  );
}

export default function DocumentsPage() {
  return (
    <FiltersProvider availableDimensions={MAIN_PAGE_DIMENSIONS}>
      <DocumentPreviewProvider>
        <DocumentsPageInner />
      </DocumentPreviewProvider>
    </FiltersProvider>
  );
}
