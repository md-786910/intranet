import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../../components/common/MaterialIcon';
import CategoryPill from '../../../components/news/CategoryPill';
import { formatRelative, readingTime } from '../../../theme/dateFormat';
import { resolveMediaUrl } from '../../../utils/mediaUtils';

// Renders the caller's saved articles in a dedicated top-of-page section,
// styled to match `PinnedUpdates` so the two read as sibling concepts.
// Source: articles flagged `my_save = true` by the list endpoint.
export default function BookmarkedNews({ articles }) {
  if (!articles || articles.length === 0) return null;

  return (
    <section className="space-y-unit-lg">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-unit-sm">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-secondary-container">
            <MaterialIcon
              name="bookmark"
              className="text-secondary text-[18px]"
              style={{ fontVariationSettings: '"FILL" 1' }}
            />
          </span>
          <h2 className="font-h2 text-h2 text-on-surface">Bookmarks</h2>
        </div>
        <span className="font-label-caps text-label-caps text-on-surface-variant uppercase">
          {articles.length} saved
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-lg">
        {articles.map((a) => (
          <BookmarkCard key={a.news_item_id} article={a} />
        ))}
      </div>
    </section>
  );
}

function BookmarkCard({ article }) {
  const [imgFailed, setImgFailed] = useState(false);
  const id = article.news_item_id;
  const categoryName = article.category?.name;
  const showImage = article.cover_image_url && !imgFailed;

  return (
    <Link
      to={`/news/${id}`}
      className="relative group bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-secondary-container/60 transition-all flex"
    >
      <div className="w-1 flex-shrink-0 bg-secondary" aria-hidden />

      <div className="flex gap-unit-md p-unit-md flex-1 min-w-0">
        <div className="w-28 h-28 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-secondary-container to-tertiary-container flex items-center justify-center">
          {showImage ? (
            <img
              src={resolveMediaUrl(article.cover_image_url)}
              alt={article.title}
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <MaterialIcon
              name="bookmark"
              className="text-secondary text-4xl opacity-60"
              style={{ fontVariationSettings: '"FILL" 1' }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0 flex flex-col justify-between py-unit-xs">
          <div className="space-y-unit-xs">
            <div className="flex items-center gap-unit-xs flex-wrap">
              {categoryName && <CategoryPill category={categoryName} variant="tag" />}
            </div>
            <h3 className="font-h3 text-base text-on-surface group-hover:text-secondary leading-snug line-clamp-2 transition-colors">
              {article.title}
            </h3>
            {article.summary && (
              <p className="font-body-sm text-on-surface-variant line-clamp-2">
                {article.summary}
              </p>
            )}
          </div>
          <p className="text-[11px] text-zinc-400 font-body-sm pt-unit-xs">
            {formatRelative(article.published_at || article.created_at)}
            {article.body && ` • ${readingTime(article.body)}`}
          </p>
        </div>
      </div>

      <div className="absolute top-3 right-3 flex items-center gap-1 bg-secondary-container/90 backdrop-blur-sm text-on-secondary-container px-2 py-1 rounded-full shadow-sm">
        <MaterialIcon
          name="bookmark"
          className="text-[12px]"
          style={{ fontVariationSettings: '"FILL" 1' }}
        />
        <span className="font-label-caps text-[10px] uppercase tracking-wide font-bold">
          Saved
        </span>
      </div>
    </Link>
  );
}
