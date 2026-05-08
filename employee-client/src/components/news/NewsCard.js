import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import CategoryPill from './CategoryPill';
import { formatRelative, readingTime } from '../../theme/dateFormat';

// Small horizontal card used in:
//   - News list "Latest News" 2-col grid
//   - Pinned Updates row (size="md")
//
// API shape it expects:
//   { news_item_id, title, summary, cover_image_url, published_at, body,
//     category: { name } | null }
export default function NewsCard({ article, size = 'sm' }) {
  if (!article) return null;
  const id = article.news_item_id;
  const categoryName = article.category?.name;

  const thumb = size === 'md' ? 'w-24 h-24' : 'w-24 h-24';
  const padding = size === 'md' ? 'p-unit-lg' : 'p-unit-md';

  return (
    <Link
      to={`/news/${id}`}
      className={`bg-white border border-outline-variant ${padding} rounded-xl shadow-sm hover:border-primary-container transition-colors cursor-pointer group flex gap-unit-md`}
    >
      <div className={`${thumb} rounded-lg overflow-hidden flex-shrink-0 bg-surface-container flex items-center justify-center`}>
        {article.cover_image_url ? (
          <img
            className="w-full h-full object-cover"
            src={article.cover_image_url}
            alt={article.title}
          />
        ) : (
          <MaterialIcon name="article" className="text-primary text-3xl" />
        )}
      </div>
      <div className="space-y-1 min-w-0">
        <CategoryPill category={categoryName} variant="tag" />
        <h4 className="font-h3 text-base text-on-surface group-hover:text-primary leading-tight line-clamp-2">
          {article.title}
        </h4>
        {size === 'md' && article.summary ? (
          <p className="font-body-sm text-body-sm text-on-surface-variant line-clamp-2">
            {article.summary}
          </p>
        ) : (
          <p className="text-xs text-on-surface-variant font-body-sm">
            {formatRelative(article.published_at || article.created_at)}
            {' • '}
            {readingTime(article.body)}
          </p>
        )}
      </div>
    </Link>
  );
}
