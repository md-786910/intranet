import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';
import FeaturedNewsCard from '../../../components/news/FeaturedNewsCard';

export default function FeaturedStory({ article }) {
  if (!article) return null;
  return (
    <section className="space-y-unit-lg">
      <div className="flex items-center gap-unit-sm">
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-container">
          <MaterialIcon
            name="star"
            className="text-secondary text-[18px]"
            style={{ fontVariationSettings: '"FILL" 1' }}
          />
        </span>
        <h2 className="font-h2 text-h2 text-on-surface">Featured Story</h2>
      </div>
      <FeaturedNewsCard article={article} />
    </section>
  );
}
