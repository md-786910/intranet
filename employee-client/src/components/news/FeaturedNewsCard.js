import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../common/MaterialIcon';
import CategoryPill from './CategoryPill';
import { formatDate, readingTime } from '../../theme/dateFormat';
import { resolveMediaUrl } from '../../utils/mediaUtils';

// Editorial-style featured card used at the top of NewsListPage.
// Side-by-side layout (image left, content right) keeps the hero from
// dominating the page when the list is rendered in a single column.
export default function FeaturedNewsCard({ article }) {
  const [imgFailed, setImgFailed] = useState(false);

  if (!article) return null;
  const id = article.news_item_id;
  const categoryName = article.category?.name;
  const showImage = article.cover_image_url && !imgFailed;

  return (
    <Link
      to={`/news/${id}`}
      className="group cursor-pointer bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow grid grid-cols-1 md:grid-cols-2"
    >
      <div className="aspect-[4/3] md:aspect-auto md:min-h-[320px] w-full overflow-hidden bg-gradient-to-br from-primary-container to-secondary-container flex items-center justify-center">
        {showImage ? (
          <img
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
            src={resolveMediaUrl(article.cover_image_url)}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <MaterialIcon name="article" className="text-primary text-7xl opacity-60" />
        )}
      </div>

      <div className="p-unit-xl flex flex-col justify-center space-y-unit-md">
        <div className="flex items-center gap-unit-md flex-wrap">
          {categoryName && <CategoryPill category={categoryName} variant="solid" />}
          <span className="text-on-surface-variant font-body-sm">
            {formatDate(article.published_at || article.created_at)}
          </span>
          {article.body && (
            <span className="text-on-surface-variant font-body-sm">
              · {readingTime(article.body)}
            </span>
          )}
        </div>

        <h2 className="font-h2 text-h2 text-on-surface leading-tight line-clamp-3 group-hover:text-primary transition-colors">
          {article.title}
        </h2>

        {article.summary && (
          <p className="font-body-md text-on-surface-variant line-clamp-3">
            {article.summary}
          </p>
        )}

        <span className="inline-flex items-center gap-unit-sm text-primary font-semibold pt-unit-xs">
          Read Full Article
          <MaterialIcon
            name="arrow_forward"
            className="text-sm group-hover:translate-x-1 transition-transform"
          />
        </span>
      </div>
    </Link>
  );
}
