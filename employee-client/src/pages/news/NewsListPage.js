import React, { useEffect, useMemo, useState } from 'react';
import { newsService } from '../../services/newsService';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import PinnedUpdates from './sections/PinnedUpdates';
import FeaturedStory from './sections/FeaturedStory';
import LatestNews from './sections/LatestNews';
import NewsletterCard from './sections/NewsletterCard';
import NewsResourcesCard from './sections/NewsResourcesCard';
import { getErrorMessage } from '../../utils/errorUtils';

const PAGE_SIZE = 20;

export default function NewsListPage() {
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    newsService
      .getArticles({ status: 'PUBLISHED', page: 1, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || res.data || {};
        setArticles(Array.isArray(data.articles) ? data.articles : []);
        setPagination(data.pagination || null);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load news.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = async () => {
    if (loadingMore || !pagination || page >= pagination.totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await newsService.getArticles({
        status: 'PUBLISHED',
        page: next,
        limit: PAGE_SIZE,
      });
      const data = res.data?.data || res.data || {};
      const more = Array.isArray(data.articles) ? data.articles : [];
      setArticles((prev) => [...prev, ...more]);
      setPagination(data.pagination || pagination);
      setPage(next);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load more articles.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const { pinned, featured, rest } = useMemo(() => splitSections(articles), [articles]);
  const canLoadMore = pagination ? page < pagination.totalPages : false;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-unit-lg lg:py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
      <div className="max-w-7xl mx-auto space-y-unit-xl">
        {loading ? (
          <NewsLoadingSkeleton />
        ) : error ? (
          <EmptyState
            icon="error"
            title="Couldn't load news"
            description={error}
          />
        ) : articles.length === 0 ? (
          <EmptyState
            icon="news"
            title="No news yet"
            description="Check back soon for the latest company updates."
          />
        ) : (
          <>
            <PinnedUpdates articles={pinned} />
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-unit-xl items-start">
              <div className="lg:col-span-8 space-y-unit-xl">
                {featured && <FeaturedStory article={featured} />}
                <LatestNews
                  articles={rest}
                  onLoadMore={loadMore}
                  canLoadMore={canLoadMore}
                />
              </div>
              <aside className="lg:col-span-4 space-y-unit-xl">
                <NewsletterCard />
                <NewsResourcesCard />
              </aside>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function splitSections(articles) {
  const pinned = articles
    .filter((a) => a.priority === 'HIGH' || a.priority === 'URGENT')
    .slice(0, 2);
  const pinnedIds = new Set(pinned.map((a) => a.news_item_id));
  const remaining = articles.filter((a) => !pinnedIds.has(a.news_item_id));
  const featured = remaining[0] || null;
  const rest = remaining.slice(1);
  return { pinned, featured, rest };
}

function NewsLoadingSkeleton() {
  return (
    <div className="space-y-unit-xl">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-lg">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
      <Skeleton className="aspect-[21/9] rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-unit-md">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-28 rounded-xl" />
      </div>
    </div>
  );
}
