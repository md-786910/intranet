import React from 'react';
import ResourceLibraryHeader from './sections/ResourceLibraryHeader';
import CategoryGrid from './sections/CategoryGrid';
import RecentlyViewedTable from './sections/RecentlyViewedTable';
import CloudStorageCard from './sections/CloudStorageCard';
import AiDiscoveryCard from './sections/AiDiscoveryCard';
import FeaturedBanner from './sections/FeaturedBanner';

export default function DocumentsPage() {
  return (
    <main className="w-full px-4 sm:px-6 lg:px-8 py-unit-xl space-y-unit-xl bg-background">
      <ResourceLibraryHeader />
      <CategoryGrid />
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
