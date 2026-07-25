import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import EmptyState from '../../components/common/EmptyState';
import Skeleton from '../../components/common/Skeleton';
import { announcementService } from '../../services/announcementService';
import { formatRelative } from '../../theme/dateFormat';
import { getErrorMessage } from '../../utils/errorUtils';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const PRIORITY_STYLE = {
  URGENT: 'bg-red-50 text-red-600 border-red-100',
  HIGH: 'bg-amber-50 text-amber-700 border-amber-100',
  NORMAL: 'bg-zinc-50 text-zinc-600 border-zinc-100',
  LOW: 'bg-zinc-50 text-zinc-500 border-zinc-100',
};

const PRIORITY_CHIPS = [
  { value: '', label: 'All' },
  { value: 'URGENT', label: 'Urgent' },
  { value: 'HIGH', label: 'High' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'LOW', label: 'Low' },
];

const VALID_PRIORITIES = new Set(['URGENT', 'HIGH', 'NORMAL', 'LOW']);

function readFiltersFromParams(searchParams) {
  const rawPriority = (searchParams.get('priority') || '').toUpperCase();
  const priority = VALID_PRIORITIES.has(rawPriority) ? rawPriority : '';
  const q = (searchParams.get('q') || '').trim();
  return { priority, q };
}

export default function AnnouncementsListPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlFilters = useMemo(() => readFiltersFromParams(searchParams), [searchParams]);

  const [priority, setPriority] = useState(urlFilters.priority);
  const [searchInput, setSearchInput] = useState(urlFilters.q);
  const [debouncedSearch, setDebouncedSearch] = useState(urlFilters.q);

  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  // Keep local state in sync when URL changes (back/forward).
  useEffect(() => {
    setPriority(urlFilters.priority);
    setSearchInput(urlFilters.q);
    setDebouncedSearch(urlFilters.q);
  }, [urlFilters.priority, urlFilters.q]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Write filters to URL when they change.
  useEffect(() => {
    const next = new URLSearchParams();
    if (priority) next.set('priority', priority);
    if (debouncedSearch) next.set('q', debouncedSearch);
    const nextStr = next.toString();
    const curStr = searchParams.toString();
    if (nextStr !== curStr) {
      setSearchParams(next, { replace: true });
    }
  }, [priority, debouncedSearch, searchParams, setSearchParams]);

  const buildParams = useCallback(
    (pageNum) => {
      const params = {
        status: 'PUBLISHED',
        page: pageNum,
        limit: PAGE_SIZE,
      };
      if (priority) params.priority = priority;
      if (debouncedSearch) params.search = debouncedSearch;
      return params;
    },
    [priority, debouncedSearch],
  );

  const filtersActive = Boolean(priority || debouncedSearch);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    announcementService
      .getAnnouncements(buildParams(1))
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
  }, [buildParams]);

  const loadMore = async () => {
    if (loadingMore || !pagination || page >= pagination.totalPages) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await announcementService.getAnnouncements(buildParams(next));
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

  const clearFilters = () => {
    setPriority('');
    setSearchInput('');
    setDebouncedSearch('');
    setSearchParams({}, { replace: true });
  };

  const canLoadMore = pagination ? page < pagination.totalPages : false;

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg lg:py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
      <div className="w-full space-y-unit-lg">
        <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <MaterialIcon name="campaign" className="text-amber-600 text-4xl" />
            <div>
              <h1 className="font-h2 text-h2">Announcements</h1>
              <p className="text-on-surface-variant text-body-sm">
                Updates from across the organisation
              </p>
            </div>
          </div>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="self-start sm:self-auto text-body-sm font-semibold text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </header>

        <div className="bg-white border border-zinc-100 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          <div className="relative">
            <MaterialIcon
              name="search"
              className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px]"
            />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search announcements…"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-zinc-200 bg-zinc-50/60 text-body-sm text-on-background placeholder:text-outline focus:outline-none focus:ring-2 focus:ring-primary-container focus:border-primary-container"
              aria-label="Search announcements"
            />
          </div>

          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by priority">
            {PRIORITY_CHIPS.map((chip) => {
              const active = priority === chip.value;
              return (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setPriority(chip.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                    active
                      ? 'bg-primary text-on-primary border-primary'
                      : 'bg-white text-on-surface-variant border-zinc-200 hover:border-primary/40 hover:text-primary'
                  }`}
                >
                  {chip.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <ListSkeleton />
        ) : error ? (
          <EmptyState icon="error" title="Couldn't load announcements" description={error} />
        ) : items.length === 0 ? (
          <EmptyState
            icon="campaign"
            title={filtersActive ? 'No announcements match your filters' : 'No announcements yet'}
            description={
              filtersActive
                ? 'Try another priority or search term, or clear filters to see everything.'
                : 'Check back soon for the latest updates.'
            }
            action={
              filtersActive ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity"
                >
                  Clear filters
                </button>
              ) : null
            }
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
