import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import Avatar from '../../components/common/Avatar';
import EmptyState from '../../components/common/EmptyState';
import NotFoundState from '../../components/common/NotFoundState';
import Skeleton from '../../components/common/Skeleton';
import { announcementService } from '../../services/announcementService';
import { formatDate, formatRelative } from '../../theme/dateFormat';
import { getErrorMessage, isNotFoundError } from '../../utils/errorUtils';

const PRIORITY_META = {
  URGENT: {
    label: 'Urgent',
    badge: 'bg-red-50 text-red-700 border-red-100',
    banner: 'from-red-500/15 via-red-50 to-transparent',
    icon: 'emergency_home',
    iconWrap: 'bg-red-100 text-red-600',
    accent: 'bg-red-500',
  },
  HIGH: {
    label: 'High priority',
    badge: 'bg-amber-50 text-amber-800 border-amber-100',
    banner: 'from-amber-500/15 via-amber-50 to-transparent',
    icon: 'campaign',
    iconWrap: 'bg-amber-100 text-amber-700',
    accent: 'bg-amber-500',
  },
  NORMAL: {
    label: 'Announcement',
    badge: 'bg-primary-container/30 text-primary border-primary-container/40',
    banner: 'from-primary-container/25 via-zinc-50 to-transparent',
    icon: 'campaign',
    iconWrap: 'bg-primary-container/40 text-primary',
    accent: 'bg-primary',
  },
  LOW: {
    label: 'FYI',
    badge: 'bg-zinc-50 text-zinc-600 border-zinc-200',
    banner: 'from-zinc-200/40 via-zinc-50 to-transparent',
    icon: 'info',
    iconWrap: 'bg-zinc-100 text-zinc-600',
    accent: 'bg-zinc-400',
  },
};

function looksLikeHtml(value) {
  return /<\/?[a-z][\s\S]*>/i.test(String(value || ''));
}

export default function AnnouncementDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    setError('');
    announcementService
      .getAnnouncement(id)
      .then((res) => {
        if (cancelled) return;
        setItem(res.data?.data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setError(getErrorMessage(err, 'Could not load this announcement.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
        <Skeleton className="h-5 w-40 rounded mb-6" />
        <div className="rounded-3xl border border-zinc-100 bg-white overflow-hidden shadow-sm">
          <Skeleton className="h-36 w-full rounded-none" />
          <div className="p-8 space-y-4">
            <Skeleton className="h-8 w-2/3 rounded" />
            <Skeleton className="h-4 w-1/3 rounded" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Announcements"
        title="Announcement not found"
        description="This announcement does not exist or is no longer available."
        backTo="/announcements"
        backLabel="Back to announcements"
      />
    );
  }

  if (error || !item) {
    return (
      <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
        <EmptyState
          icon="error"
          title="Announcement not available"
          description={error || 'This announcement no longer exists or you do not have access.'}
          action={
            <Link
              to="/announcements"
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-on-primary rounded-lg font-semibold hover:opacity-90 transition-opacity"
            >
              ← Back to announcements
            </Link>
          }
        />
      </div>
    );
  }

  return <AnnouncementDetailView item={item} />;
}

function AnnouncementDetailView({ item }) {
  const priority = item.priority || 'NORMAL';
  const meta = PRIORITY_META[priority] || PRIORITY_META.NORMAL;
  const time = item.published_at || item.created_at;
  const author = item.author;
  const authorName = author
    ? `${author.first_name || ''} ${author.last_name || ''}`.trim() || author.email || 'Team'
    : 'Team';
  const body = item.body || '';
  const htmlBody = useMemo(() => looksLikeHtml(body), [body]);

  return (
    <div className="w-full max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl bg-background min-h-[calc(100vh-10rem)]">
      <Link
        to="/announcements"
        className="inline-flex items-center gap-unit-xs text-on-surface-variant hover:text-primary transition-colors mb-unit-lg group"
      >
        <MaterialIcon name="arrow_back" className="text-lg group-hover:-translate-x-0.5 transition-transform" />
        <span className="font-body-sm text-body-sm font-medium">All announcements</span>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter items-start">
        <article className="lg:col-span-8 bg-white border border-zinc-100 rounded-3xl shadow-sm overflow-hidden">
          <div className={`relative bg-gradient-to-br ${meta.banner} px-6 sm:px-10 pt-8 pb-10`}>
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${meta.accent}`} />
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <span
                className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${meta.badge}`}
              >
                <MaterialIcon name={meta.icon} className="text-sm" />
                {meta.label}
              </span>
              {time && (
                <span className="text-xs text-on-surface-variant">
                  {formatRelative(time)}
                </span>
              )}
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] leading-tight text-on-background max-w-3xl">
              {item.title}
            </h1>
          </div>

          <div className="px-6 sm:px-10 py-8 border-t border-zinc-100">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-zinc-50">
              <Avatar
                src={author?.avatar_url}
                name={authorName}
                size="lg"
              />
              <div className="min-w-0">
                <p className="font-semibold text-body-md text-on-background truncate">
                  {authorName}
                </p>
                <p className="text-body-sm text-on-surface-variant">
                  {[author?.job_title, formatDate(time)].filter(Boolean).join(' · ') || 'Company update'}
                </p>
              </div>
            </div>

            {htmlBody ? (
              <div
                className="prose prose-zinc prose-lg max-w-none prose-p:leading-relaxed prose-headings:font-semibold"
                dangerouslySetInnerHTML={{ __html: body }}
              />
            ) : (
              <p className="text-lg leading-relaxed text-on-background whitespace-pre-wrap">
                {body || 'No additional details were provided.'}
              </p>
            )}
          </div>
        </article>

        <aside className="lg:col-span-4 space-y-4">
          <div className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${meta.iconWrap}`}>
              <MaterialIcon name={meta.icon} className="text-2xl" />
            </div>
            <h2 className="font-h3 text-h3 mb-2">About this notice</h2>
            <p className="text-body-sm text-on-surface-variant leading-relaxed mb-5">
              Company announcements stay visible in your portal until they expire or are archived.
            </p>
            <dl className="space-y-3 text-body-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">Priority</dt>
                <dd className="font-semibold text-on-background">{meta.label}</dd>
              </div>
              {time && (
                <div className="flex justify-between gap-3">
                  <dt className="text-on-surface-variant">Published</dt>
                  <dd className="font-semibold text-on-background text-right">
                    {formatDate(time)}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-on-surface-variant">From</dt>
                <dd className="font-semibold text-on-background text-right truncate max-w-[10rem]">
                  {authorName}
                </dd>
              </div>
            </dl>
          </div>

          <Link
            to="/announcements"
            className="flex items-center justify-between gap-3 bg-primary-container/20 hover:bg-primary-container/35 border border-primary-container/30 rounded-3xl p-unit-lg transition-colors group"
          >
            <div>
              <p className="font-semibold text-on-background">More announcements</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">
                Browse the full company feed
              </p>
            </div>
            <MaterialIcon
              name="arrow_forward"
              className="text-primary text-2xl group-hover:translate-x-0.5 transition-transform"
            />
          </Link>
        </aside>
      </div>
    </div>
  );
}
