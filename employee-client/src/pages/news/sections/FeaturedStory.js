import React from 'react';
import FeaturedNewsCard from '../../../components/news/FeaturedNewsCard';

export default function FeaturedStory({ article }) {
  if (!article) return null;
  return (
    <section className="space-y-unit-lg">
      <h2 className="font-h2 text-h2 text-on-surface">Featured Story</h2>
      <FeaturedNewsCard article={article} />
    </section>
  );
}
