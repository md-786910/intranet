import React from 'react';
import Avatar from '../../../components/common/Avatar';
import CategoryPill from '../../../components/news/CategoryPill';
import { formatDate, readingTime } from '../../../theme/dateFormat';

export default function ArticleHeader({ article }) {
  if (!article) return null;
  const author = article.author;
  const authorName = author
    ? [author.first_name, author.last_name].filter(Boolean).join(' ') || author.email
    : '';
  const meta = [
    formatDate(article.published_at || article.created_at),
    readingTime(article.body),
  ]
    .filter(Boolean)
    .join(' • ');

  return (
    <div className="max-w-4xl mx-auto mb-unit-lg">
      {article.category?.name && (
        <div className="mb-unit-md">
          <CategoryPill category={article.category.name} variant="solid" />
        </div>
      )}
      <h1 className="font-h1 text-h1 text-on-background mb-unit-md leading-tight">
        {article.title}
      </h1>
      {author && (
        <div className="flex items-center gap-unit-md mb-unit-lg">
          <Avatar src={author.avatar_url} name={authorName} size="lg" />
          <div>
            <p className="font-h3 text-body-md text-on-background font-semibold">
              {authorName}
            </p>
            <p className="font-body-sm text-body-sm text-on-surface-variant">
              {[author.job_title, meta].filter(Boolean).join(' • ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
