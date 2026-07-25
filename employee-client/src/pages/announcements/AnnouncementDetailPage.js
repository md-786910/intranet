import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import MaterialIcon from '../../components/common/MaterialIcon';
import EmptyState from '../../components/common/EmptyState';
import NotFoundState from '../../components/common/NotFoundState';
import Skeleton from '../../components/common/Skeleton';
import { announcementService } from '../../services/announcementService';
import { formatRelative } from '../../theme/dateFormat';
import { getErrorMessage, isNotFoundError } from '../../utils/errorUtils';

const PRIORITY_LABEL = {
  URGENT: 'Urgent',
  HIGH: 'High priority',
  NORMAL: 'Announcement',
  LOW: 'Low priority',
};

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
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg space-y-4">
        <Skeleton className="h-6 w-32 rounded" />
        <Skeleton className="h-10 w-3/4 rounded" />
        <Skeleton className="h-4 w-1/2 rounded" />
        <Skeleton className="h-64 w-full rounded-xl" />
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
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-xl">
        <EmptyState
          icon="error"
          title="Announcement not available"
          description={error || 'This announcement no longer exists or you do not have access.'}
        />
      </div>
    );
  }

  const priority = item.priority || 'NORMAL';
  const time = item.published_at || item.created_at;
  const authorName = item.author
    ? `${item.author.first_name || ''} ${item.author.last_name || ''}`.trim() || 'Team'
    : 'Team';

  return (
    <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-unit-lg lg:py-unit-xl">
      <Link to="/announcements" className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline mb-4">
        <MaterialIcon name="arrow_back" className="text-base" />
        All announcements
      </Link>

      <article className="bg-white border border-zinc-100 rounded-3xl p-unit-lg shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-100">
            <MaterialIcon name="campaign" className="text-sm" />
            {PRIORITY_LABEL[priority] || 'Announcement'}
          </span>
        </div>

        <h1 className="font-h1 text-h1 mb-2">{item.title}</h1>
        <p className="text-on-surface-variant text-body-sm mb-unit-md">
          {authorName} · {formatRelative(time)}
        </p>

        <div
          className="prose prose-zinc max-w-none"
          dangerouslySetInnerHTML={{ __html: item.body || '' }}
        />
      </article>
    </div>
  );
}
