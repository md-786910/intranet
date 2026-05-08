import React from 'react';
import ResourceLibraryHeader from './sections/ResourceLibraryHeader';
import CategoryGrid from './sections/CategoryGrid';
import RecentlyViewedTable from './sections/RecentlyViewedTable';
import CloudStorageCard from './sections/CloudStorageCard';
import AiDiscoveryCard from './sections/AiDiscoveryCard';
import FeaturedBanner from './sections/FeaturedBanner';
import { FiltersProvider } from './FiltersContext';
import { DocumentPreviewProvider } from './DocumentPreviewContext';
import useCategories from './useCategories';

// Category cards on the main page only support search + category-chip
// filtering; priority/file-type apply to documents inside a category, not
// to the cards themselves.
const MAIN_PAGE_DIMENSIONS = { search: true, categoryIds: true, priorities: false, fileTypes: false };

function DocumentsPageInner() {
  const { categories, loading, error } = useCategories();

  return (
    <main className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl space-y-unit-xl bg-background">
      <ResourceLibraryHeader categories={categories} />
      <CategoryGrid categories={categories} loading={loading} error={error} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
        <RecentlyViewedTable />
        <div className="space-y-gutter">
          <CloudStorageCard />
          <AiDiscoveryCard />
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
