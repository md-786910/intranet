import React from 'react';
import { Link } from 'react-router-dom';
import SectionHeader from '../../../components/common/SectionHeader';
import NewsCard from '../../../components/news/NewsCard';

export default function PinnedUpdates({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="space-y-unit-lg mb-unit-xl">
      <SectionHeader
        title="Pinned Updates"
        right={
          <Link
            to="/news/pinned"
            className="text-primary font-body-sm cursor-pointer hover:underline"
          >
            View All
          </Link>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-lg">
        {articles.map((a) => (
          <NewsCard key={a.news_item_id} article={a} size="md" />
        ))}
      </div>
    </section>
  );
}
