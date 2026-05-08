import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { newsService } from '../../services/newsService';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import ArticleHeader from './detail/ArticleHeader';
import ArticleHero from './detail/ArticleHero';
import ArticleBody from './detail/ArticleBody';
import EngagementBar from './detail/EngagementBar';
import TakeActionCard from './detail/TakeActionCard';
import RelatedArticles from './detail/RelatedArticles';
import { getErrorMessage } from '../../utils/errorUtils';

export default function NewsDetailPage() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setArticle(null);
    newsService
      .getArticle(id)
      .then((res) => {
        if (cancelled) return;
        setArticle(res.data?.data || res.data);
      })
      .catch((err) => {
        if (!cancelled)
          setError(getErrorMessage(err, 'Article not found.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="max-w-container-max mx-auto px-gutter py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
      {loading ? (
        <DetailSkeleton />
      ) : error ? (
        <EmptyState
          icon="error"
          title="Couldn't load article"
          description={error}
          action={
            <Link
              to="/news"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              ← Back to News
            </Link>
          }
        />
      ) : article ? (
        <>
          {/* Article Header — narrower reading column */}
          <ArticleHeader article={article} />

          {/* Hero Image — full width of the 1280px container */}
          <ArticleHero article={article} />

          {/* Article Content — narrower reading column with sidebar */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-unit-xl">
              <article className="md:col-span-12 lg:col-span-8">
                <ArticleBody body={article.body} />
                <EngagementBar likes={0} comments={0} />
              </article>

              <aside className="md:col-span-12 lg:col-span-4">
                <div className="lg:sticky lg:top-24 space-y-unit-xl">
                  <TakeActionCard />
                </div>
              </aside>
            </div>
          </div>

          {/* Related Articles — full width */}
          <RelatedArticles ids={article.related_news_ids || []} />
        </>
      ) : null}
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-unit-lg">
      <Skeleton className="h-6 w-32 rounded-full" />
      <Skeleton className="h-10 w-full rounded-lg" />
      <Skeleton className="h-10 w-3/4 rounded-lg" />
      <div className="flex items-center gap-3">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-3 w-48 rounded" />
        </div>
      </div>
      <Skeleton className="aspect-[21/9] rounded-xl" />
      <Skeleton className="h-32 w-full rounded-lg" />
    </div>
  );
}
