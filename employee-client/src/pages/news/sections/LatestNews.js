import React from 'react';
import SectionHeader from '../../../components/common/SectionHeader';
import NewsCard from '../../../components/news/NewsCard';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function LatestNews({ articles, onLoadMore, canLoadMore }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="space-y-unit-lg">
      <SectionHeader
        title="Latest News"
        right={
          <button
            type="button"
            className="text-on-surface-variant cursor-pointer hover:text-on-surface transition-colors"
            aria-label="Filter"
          >
            <MaterialIcon name="filter_list" />
          </button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        {articles.map((a) => (
          <NewsCard key={a.news_item_id} article={a} size="sm" />
        ))}
      </div>
      {canLoadMore && (
        <button
          type="button"
          onClick={onLoadMore}
          className="w-full py-unit-sm border border-outline-variant rounded-lg font-semibold text-on-surface hover:bg-surface-container transition-colors"
        >
          View News Archive
        </button>
      )}
    </section>
  );
}
