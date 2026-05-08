import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import { resolveMediaUrl } from '../../utils/mediaUtils';

// Vertical card used in the "Related Articles" section on the detail page.
export default function RelatedCard({ article }) {
  if (!article) return null;
  const id = article.news_item_id;
  const categoryName = article.category?.name;

  return (
    <Link
      to={`/news/${id}`}
      className="group bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer block"
    >
      <div className="h-48 w-full overflow-hidden bg-surface-container-low">
        {article.cover_image_url ? (
          <img
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            src={resolveMediaUrl(article.cover_image_url)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <MaterialIcon name="article" className="text-primary text-5xl" />
          </div>
        )}
      </div>
      <div className="p-unit-lg">
        {categoryName && (
          <span className="text-xs font-bold text-primary uppercase tracking-wider mb-unit-xs block">
            {categoryName}
          </span>
        )}
        <h3 className="font-h3 text-h3 text-on-surface mb-unit-sm line-clamp-2">
          {article.title}
        </h3>
        {article.summary && (
          <p className="text-body-sm text-on-surface-variant line-clamp-2">
            {article.summary}
          </p>
        )}
      </div>
    </Link>
  );
}
