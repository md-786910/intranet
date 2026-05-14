import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { announcementService } from '../../services/announcementService';
import { formatRelative } from '../../theme/dateFormat';
import { getErrorMessage } from '../../utils/errorUtils';

const PAGE_SIZE = 20;

const PRIORITY_STYLE = {
  URGENT: 'bg-red-50 text-red-600 border-red-100',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-100',
  NORMAL: 'bg-zinc-50 text-zinc-600 border-zinc-100',
  LOW: 'bg-zinc-50 text-zinc-500 border-zinc-100',
};

export default function AnnouncementsListPage() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    announcementService
      .getAnnouncements({ status: 'PUBLISHED', page: 1, limit: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return;
        const data = res.data?.data || res.data || {};
        setItems(Array.isArray(data.announcements) ? data.announcements : []);
        setPagination(data.pagination || null);
        setPage(1);
      })
      .catch((err) => {
        if (!cancelled) setError(getErrorMessage(err, 'Could not load announcements.'));
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
      const res = await announcementService.getAnnouncements({
        status: 'PUBLISHED',
        page: next,
        limit: PAGE_SIZE,
      });
      const data = res.data?.data || res.data || {};
      const more = Array.isArray(data.announcements) ? data.announcements : [];
      setItems((prev) => [...prev, ...more]);
      setPagination(data.pagination || pagination);
      setPage(next);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not load more announcements.'));
    } finally {
      setLoadingMore(false);
    }
  };

  const canLoadMore = pagination ? page < pagination.totalPages : false;

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg lg:py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
      <div className="w-full space-y-unit-xl">
        <header className="flex items-center gap-3">
          <MaterialIcon name="campaign" className="text-amber-600 text-4xl" />
          <div>
            <h1 className="font-h2 text-h2">Announcements</h1>
            <p className="text-on-surface-variant text-body-sm">
              Updates from across the organisation
            </p>
          </div>
        </header>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <EmptyState icon="error" title="Couldn't load announcements" description={error} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="campaign"
            title="No announcements yet"
            description="Check back soon for the latest updates."
          />
        ) : (
          <>
            <ul className="space-y-4">
              {items.map((item) => (
                <AnnouncementCard key={item.announcement_item_id} item={item} />
              ))}
            </ul>
            {canLoadMore && (
              <div className="flex justify-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="px-6 py-2 rounded-full bg-primary text-on-primary font-semibold text-body-sm hover:opacity-90 disabled:opacity-50"
                >
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function AnnouncementCard({ item }) {
  const priority = item.priority || 'NORMAL';
  const style = PRIORITY_STYLE[priority] || PRIORITY_STYLE.NORMAL;
  const time = item.published_at || item.created_at;

  return (
    <li>
      <Link
        to={`/announcements/${item.announcement_item_id}`}
        className="block bg-white border border-zinc-100 rounded-2xl p-unit-md shadow-sm hover:border-primary/30 hover:shadow transition"
      >
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <MaterialIcon name="campaign" className="text-2xl" />
          </div>
          <div className="min-w-0 flex-grow">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-h3 text-h3 line-clamp-1 group-hover:text-primary">
                {item.title}
              </h3>
              {(priority === 'URGENT' || priority === 'HIGH') && (
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${style}`}>
                  {priority}
                </span>
              )}
            </div>
            <p className="text-body-sm text-on-surface-variant mt-1">
              {item.author
                ? `${item.author.first_name || ''} ${item.author.last_name || ''}`.trim() || 'Team'
                : 'Team'}{' '}
              · {formatRelative(time)}
            </p>
          </div>
        </div>
      </Link>
    </li>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-zinc-100 rounded-2xl p-unit-md flex items-start gap-4">
          <Skeleton className="w-12 h-12 rounded-xl shrink-0" />
          <div className="flex-grow space-y-2">
            <Skeleton className="h-5 w-1/2 rounded" />
            <Skeleton className="h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
