import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Skeleton from '../../components/common/Skeleton';
import { newsService } from '../../services/newsService';
import { categoryPalette } from '../../theme/categoryColors';

const LIMIT = 2;

// Stable icon selection — same article always gets the same icon.
// Categories map to a meaningful icon; everything else picks from a pool
// using the article id as the seed so different articles look different.
const CATEGORY_ICONS = {
  strategy: 'campaign',
  'company strategy': 'campaign',
  marketing: 'brush',
  culture: 'celebration',
  engineering: 'memory',
  innovation: 'lightbulb',
  'global expansion': 'public',
  sustainability: 'eco',
  community: 'groups',
  management: 'analytics',
  policy: 'policy',
  policies: 'policy',
  'human resources': 'badge',
};

const FALLBACK_ICONS = [
  'campaign',
  'auto_awesome',
  'lightbulb',
  'rocket_launch',
  'trending_up',
  'stars',
  'newspaper',
  'bolt',
];

function iconFor(article) {
  const cat = article.category?.name?.trim().toLowerCase();
  if (cat && CATEGORY_ICONS[cat]) return CATEGORY_ICONS[cat];
  const seed = article.news_item_id ?? 0;
  return FALLBACK_ICONS[Math.abs(seed) % FALLBACK_ICONS.length];
}

export default function LatestAnnouncements() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    newsService
      .getArticles({ status: 'PUBLISHED', page: 1, limit: LIMIT })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || res.data || {};
        setArticles(Array.isArray(data.articles) ? data.articles.slice(0, LIMIT) : []);
      })
      .catch(() => {
        if (!cancelled) setArticles([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-h3 text-h3">Latest Announcements</h3>
        <Link
          to="/news"
          className="text-primary font-semibold text-body-sm hover:underline"
        >
          View all
        </Link>
      </div>

      {loading ? (
        <LoadingState />
      ) : articles.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant py-4">
          No announcements yet. Check back soon.
        </p>
      ) : (
        <div className="space-y-4">
          {articles.map((a) => (
            <AnnouncementRow key={a.news_item_id} article={a} />
          ))}
        </div>
      )}
    </div>
  );
}

function AnnouncementRow({ article }) {
  const categoryName = article.category?.name;
  const palette = categoryPalette(categoryName);
  return (
    <Link
      to={`/news/${article.news_item_id}`}
      className="flex gap-4 p-4 border border-zinc-50 rounded-2xl hover:bg-zinc-50 transition-colors group"
    >
      <div className="w-20 h-20 bg-primary-container/20 rounded-xl flex-shrink-0 flex items-center justify-center">
        <MaterialIcon name={iconFor(article)} className="text-primary text-3xl" />
      </div>
      <div className="min-w-0">
        {categoryName && (
          <span
            className={`text-[10px] font-bold ${palette.text} uppercase tracking-widest`}
          >
            {categoryName}
          </span>
        )}
        <h4 className="font-semibold text-body-md mt-1 line-clamp-2 group-hover:text-primary transition-colors">
          {article.title}
        </h4>
        {article.summary && (
          <p className="text-body-sm text-on-surface-variant mt-1 line-clamp-2">
            {article.summary}
          </p>
        )}
      </div>
    </Link>
  );
}

function LoadingState() {
  return (
    <div className="space-y-4">
      {Array.from({ length: LIMIT }).map((_, i) => (
        <div
          key={i}
          className="flex gap-4 p-4 border border-zinc-50 rounded-2xl"
        >
          <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
          <div className="flex-grow space-y-2">
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="h-4 w-3/4 rounded" />
            <Skeleton className="h-3 w-full rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
