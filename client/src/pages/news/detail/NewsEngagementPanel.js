import React, { useEffect, useState } from 'react';
import { newsService } from '../../../services/newsService';
import { useToast } from '../../../hooks/useToast';
import { formatDate } from '../../../utils/formatters';
import Pagination from '../../../components/common/Pagination';

const TABS = [
  { key: 'likes', label: 'Likes' },
  { key: 'comments', label: 'Comments' },
  { key: 'shares', label: 'Shares' },
];

const CHANNEL_LABEL = {
  LINK_COPY: 'Copied link',
  EMAIL: 'Email',
};

function fullName(u) {
  if (!u) return 'Unknown user';
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email || 'Unknown user';
}

function Avatar({ user, size = 32 }) {
  const initials = `${(user?.first_name || '?').charAt(0)}${(user?.last_name || '').charAt(0)}`.toUpperCase();
  if (user?.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-gray-100"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xs font-semibold"
    >
      {initials}
    </div>
  );
}

export default function NewsEngagementPanel({ articleId }) {
  const { addToast } = useToast();
  const [tab, setTab] = useState('likes');
  const [counts, setCounts] = useState({ like_count: 0, comment_count: 0, share_count: 0, save_count: 0 });
  const [data, setData] = useState({ items: [], pagination: { page: 1, totalPages: 1, total: 0 } });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Load summary once per article
  useEffect(() => {
    if (!articleId) return;
    newsService.getEngagement(articleId)
      .then((res) => setCounts(res.data?.data?.counts || counts))
      .catch(() => addToast('Failed to load engagement', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId]);

  // Reset to page 1 when tab changes
  useEffect(() => { setPage(1); }, [tab]);

  // Load list for active tab
  useEffect(() => {
    if (!articleId) return;
    let cancelled = false;
    setLoading(true);
    const params = { page, limit: 20 };
    const apiCall = tab === 'likes'
      ? newsService.listEngagementLikes(articleId, params)
      : tab === 'comments'
      ? newsService.listEngagementComments(articleId, { ...params, include_deleted: true })
      : newsService.listEngagementShares(articleId, params);

    apiCall
      .then((res) => {
        if (cancelled) return;
        const payload = res.data?.data || {};
        const items = payload[tab] || [];
        setData({ items, pagination: payload.pagination || { page: 1, totalPages: 1, total: items.length } });
      })
      .catch(() => { if (!cancelled) addToast('Failed to load list', 'error'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleId, tab, page]);

  const moderate = async (commentId) => {
    try {
      await newsService.moderateComment(articleId, commentId);
      addToast('Comment removed', 'success');
      setData((prev) => ({
        ...prev,
        items: prev.items.map((c) => (c.id === commentId ? { ...c, deleted: true, deleted_at: new Date().toISOString() } : c)),
      }));
      setCounts((c) => ({ ...c, comment_count: Math.max(0, c.comment_count - 1) }));
    } catch {
      addToast('Failed to remove comment', 'error');
    }
  };

  return (
    <section>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Engagement</h3>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 bg-gray-50/40 border-b border-gray-100 flex items-center gap-6 text-sm">
          <Stat label="Likes" value={counts.like_count} />
          <Sep />
          <Stat label="Comments" value={counts.comment_count} />
          <Sep />
          <Stat label="Shares" value={counts.share_count} />
          <Sep />
          <Stat label="Saves" value={counts.save_count} />
        </div>

        <div className="border-b border-gray-100 px-4 pt-2 flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="px-2 py-2">
          {loading && data.items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : data.items.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              No {tab} yet.
            </p>
          ) : tab === 'likes' ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Liked at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <Avatar user={row.user} />
                      <span className="text-sm font-medium text-gray-900">{fullName(row.user)}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{row.user?.email || '—'}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDate(row.liked_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === 'comments' ? (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">Author</th>
                  <th className="px-4 py-2">Comment</th>
                  <th className="px-4 py-2">Posted</th>
                  <th className="px-4 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((c) => (
                  <tr key={c.id} className={c.deleted ? 'opacity-50' : ''}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <Avatar user={c.author} />
                      <span className="text-sm font-medium text-gray-900">{fullName(c.author)}</span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 align-top whitespace-pre-wrap break-words max-w-[420px]">
                      {c.deleted ? <em className="text-gray-400">[Removed by moderator]</em> : c.body}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDate(c.created_at)}</td>
                    <td className="px-4 py-2 text-right">
                      {!c.deleted && (
                        <button
                          type="button"
                          onClick={() => moderate(c.id)}
                          className="text-xs font-semibold text-red-600 hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  <th className="px-4 py-2">User</th>
                  <th className="px-4 py-2">Channel</th>
                  <th className="px-4 py-2">Views</th>
                  <th className="px-4 py-2">Shared at</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.items.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 flex items-center gap-2">
                      <Avatar user={s.user} />
                      <span className="text-sm font-medium text-gray-900">{fullName(s.user)}</span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                        {CHANNEL_LABEL[s.channel] || s.channel}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700">{s.view_count}</td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDate(s.shared_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {data.pagination?.totalPages > 1 && (
          <div className="border-t border-gray-100 px-4 py-2">
            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              total={data.pagination.total}
              limit={20}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </section>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-base font-semibold text-gray-900">{value}</span>
      <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
  );
}

function Sep() {
  return <span className="text-gray-300">·</span>;
}
