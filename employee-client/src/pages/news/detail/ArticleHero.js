import React from 'react';
import MaterialIcon from '../../../components/common/MaterialIcon';

export default function ArticleHero({ article }) {
  if (!article) return null;
  return (
    <div className="mb-unit-xl">
      <div className="aspect-[21/9] rounded-xl overflow-hidden border border-outline-variant shadow-sm bg-surface-container-low">
        {article.cover_image_url ? (
          <img
            alt={article.title}
            className="w-full h-full object-cover"
            src={article.cover_image_url}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MaterialIcon name="article" className="text-primary text-7xl" />
          </div>
        )}
      </div>
    </div>
  );
}
