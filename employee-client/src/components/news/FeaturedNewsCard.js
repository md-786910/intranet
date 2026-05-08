import React from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import CategoryPill from './CategoryPill';
import { formatDate } from '../../theme/dateFormat';

// Big 21:9 hero card used at the top of NewsListPage
export default function FeaturedNewsCard({ article }) {
  if (!article) return null;
  const id = article.news_item_id;
  const categoryName = article.category?.name;

  return (
    <Link
      to={`/news/${id}`}
      className="group cursor-pointer relative bg-white border border-outline-variant rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow block"
    >
      <div className="aspect-[21/9] w-full overflow-hidden bg-surface-container-low">
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
      <div className="p-unit-xl space-y-unit-lg">
        <div className="flex items-center gap-unit-md flex-wrap">
          {categoryName && <CategoryPill category={categoryName} variant="solid" />}
          <span className="text-on-surface-variant font-body-sm">
            {formatDate(article.published_at || article.created_at)}
          </span>
        </div>
        <div className="space-y-unit-md">
          <h1 className="font-h1 text-h1 text-on-surface leading-tight">
            {article.title}
          </h1>
          {article.summary && (
            <p className="font-body-lg text-on-surface-variant max-w-3xl">
              {article.summary}
            </p>
          )}
        </div>
        <span className="bg-primary text-on-primary px-unit-xl py-unit-sm rounded-lg font-semibold inline-flex items-center gap-unit-sm hover:opacity-90 transition-all shadow-sm">
          Read Full Article
          <MaterialIcon name="arrow_forward" className="text-sm" />
        </span>
      </div>
    </Link>
  );
}
