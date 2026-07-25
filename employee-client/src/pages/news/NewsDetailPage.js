import React, { useEffect, useRef, useState } from 'react';
import MaterialIcon from '../../components/common/MaterialIcon';
import { Link, useParams } from 'react-router-dom';
import { newsService } from '../../services/newsService';
import EmptyState from '../../components/common/EmptyState';
import NotFoundState from '../../components/common/NotFoundState';
import Skeleton from '../../components/common/Skeleton';
import ArticleHeader from './detail/ArticleHeader';
import ArticleHero from './detail/ArticleHero';
import ArticleBody from './detail/ArticleBody';
import EngagementBar from './detail/EngagementBar';
import CommentsSection from './detail/CommentsSection';
import RelatedArticles from './detail/RelatedArticles';
import { getErrorMessage, isNotFoundError } from '../../utils/errorUtils';
import { formatRelative } from '../../theme/dateFormat';
import { useAuth } from '../../hooks/useAuth';

export default function NewsDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [commentCount, setCommentCount] = useState(0);
  const commentsRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setNotFound(false);
    setArticle(null);
    newsService
      .getArticle(id)
      .then((res) => {
        if (cancelled) return;
        const a = res.data?.data || res.data;
        setArticle(a);
        if (a?.comment_count != null) setCommentCount(a.comment_count);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setError(getErrorMessage(err, "Couldn't load article."));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (notFound) {
    return (
      <NotFoundState
        pageTitle="News"
        title="Article not found"
        description="This article does not exist or is no longer available."
        backTo="/news"
        backLabel="Back to news"
      />
    );
  }

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
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
          {/* Back arrow — left-aligned */}
          <Link
            to="/news"
            className="inline-flex items-center gap-unit-xs text-on-surface-variant hover:text-primary transition-colors mb-unit-md group"
          >
            <MaterialIcon name="arrow_back" className="text-lg group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-body-sm text-body-sm font-medium">Back to News</span>
          </Link>

          {/* Article Header — narrower reading column */}
          <ArticleHeader article={article} />

          {/* Hero Image — full width of the 1280px container */}
          <ArticleHero article={article} />

          {/* Article + Comments — single centered reading column */}
          <div className="max-w-3xl mx-auto">
            <article>
              <ArticleBody body={article.body} />
              {(article.published_at || article.created_at) && (
                <p className="text-[11px] text-zinc-400 mt-unit-lg">
                  Posted {formatRelative(article.published_at || article.created_at)}
                </p>
              )}
              <EngagementBar
                articleId={article.news_item_id}
                title={article.title}
                initialLiked={!!article.my_like}
                initialSaved={!!article.my_save}
                initialLikeCount={article.like_count || 0}
                initialCommentCount={commentCount}
                initialShareCount={article.share_count || 0}
                onCommentClick={() => commentsRef.current?.focusComposer()}
              />
            </article>

            <section className="mt-unit-xl pt-unit-xl border-t border-outline-variant/40">
              <CommentsSection
                ref={commentsRef}
                articleId={article.news_item_id}
                currentUserId={user?.user_id}
                onCountChange={setCommentCount}
              />
            </section>
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
