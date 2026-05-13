import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Pagination from '../../components/common/Pagination';
import { activityService } from '../../services/activityService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatRelativeTime } from '../../utils/formatters';

const ENTITY_FILTERS = [
  { value: '',         label: 'All' },
  { value: 'NEWS',     label: 'News' },
  { value: 'DOCUMENT', label: 'Documents' },
  { value: 'CATEGORY', label: 'Categories' },
  { value: 'MEDIA',    label: 'Media' },
];

const KIND_STYLES = {
  created:     { label: 'Created',     dot: 'bg-blue-500',    ring: 'bg-blue-50' },
  updated:     { label: 'Updated',     dot: 'bg-gray-400',    ring: 'bg-gray-100' },
  published:   { label: 'Published',   dot: 'bg-emerald-500', ring: 'bg-emerald-50' },
  unpublished: { label: 'Unpublished', dot: 'bg-amber-500',   ring: 'bg-amber-50' },
  archived:    { label: 'Archived',    dot: 'bg-orange-500',  ring: 'bg-orange-50' },
  uploaded:    { label: 'Uploaded',    dot: 'bg-indigo-500',  ring: 'bg-indigo-50' },
  deleted:     { label: 'Deleted',     dot: 'bg-red-500',     ring: 'bg-red-50' },
};

const KIND_ICONS = {
  created: 'M12 4.5v15m7.5-7.5h-15',
  uploaded: 'M12 4.5v15m7.5-7.5h-15',
  updated: 'M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zM19.5 7.125L16.875 4.5',
  published: 'M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5',
  unpublished: 'M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88',
  archived: 'M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z',
  deleted: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0',
};

const ENTITY_LABEL = {
  NEWS: 'news article',
  DOCUMENT: 'document',
  CATEGORY: 'category',
  MEDIA: 'media',
};

function nameOf(user) {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : user.email || null;
}

function initialsOf(user) {
  if (!user) return '?';
  const parts = [user.first_name, user.last_name].filter(Boolean);
  if (parts.length === 0) return (user.email || '?').slice(0, 2).toUpperCase();
  return parts.map((p) => p.charAt(0).toUpperCase()).join('').slice(0, 2);
}

// Group events into Today / Yesterday / This week / Earlier buckets.
function groupByDate(events) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
  const startOfWeek = startOfToday - 7 * 24 * 60 * 60 * 1000;

  const buckets = { Today: [], Yesterday: [], 'This week': [], Earlier: [] };
  events.forEach((ev) => {
    const t = new Date(ev.at).getTime();
    if (t >= startOfToday) buckets.Today.push(ev);
    else if (t >= startOfYesterday) buckets.Yesterday.push(ev);
    else if (t >= startOfWeek) buckets['This week'].push(ev);
    else buckets.Earlier.push(ev);
  });
  return buckets;
}

function ActorAvatar({ user }) {
  if (!user) {
    return (
      <span className="inline-flex w-7 h-7 rounded-full bg-gray-100 text-gray-400 items-center justify-center text-[10px] font-semibold flex-shrink-0">
        ?
      </span>
    );
  }
  return (
    <span
      className="inline-flex w-7 h-7 rounded-full bg-primary-100 text-primary-700 items-center justify-center text-[11px] font-semibold flex-shrink-0"
      title={nameOf(user)}
    >
      {initialsOf(user)}
    </span>
  );
}

function EventRow({ event, onOpen }) {
  const style = KIND_STYLES[event.kind] || KIND_STYLES.updated;
  const iconPath = KIND_ICONS[event.kind] || KIND_ICONS.updated;
  const actorName = nameOf(event.actor) || 'Unknown';
  const entityLabel = ENTITY_LABEL[event.entity_type] || event.entity_type.toLowerCase();
  const verb = (style.label || event.kind).toLowerCase();

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0">
      <span
        className={`inline-flex w-7 h-7 rounded-full ${style.dot} items-center justify-center ring-4 ${style.ring} flex-shrink-0`}
        title={formatDateTime(event.at)}
      >
        <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d={iconPath} />
        </svg>
      </span>
      <ActorAvatar user={event.actor} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-gray-900 leading-snug">
          <span className="font-semibold">{actorName}</span>
          <span className="text-gray-600"> {verb} {entityLabel} </span>
          {event.entity_link ? (
            <button
              type="button"
              onClick={() => onOpen(event.entity_link)}
              className="font-medium text-primary-700 hover:text-primary-800 hover:underline"
            >
              “{event.entity_title || 'Untitled'}”
            </button>
          ) : (
            <span className="font-medium text-gray-900">“{event.entity_title || 'Untitled'}”</span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {formatRelativeTime(event.at)} <span className="text-gray-300 mx-1">·</span> {formatDateTime(event.at)}
        </div>
      </div>
    </li>
  );
}

export default function ActivityLogPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { isOwner } = useAuth();
  const { page, limit, setPage } = usePagination();
  const [entityFilter, setEntityFilter] = useState('');
  const [data, setData] = useState({ events: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (entityFilter) params.entity_type = entityFilter;
      const res = await activityService.list(params);
      setData(res.data?.data || { events: [], pagination: {} });
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to load activity', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, entityFilter, addToast]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const handleEntityFilter = (value) => {
    setEntityFilter(value);
    setPage(1);
  };

  const grouped = groupByDate(data.events || []);

  return (
    <div>
      <PageHeader
        title="Activity log"
        subtitle={
          isOwner
            ? 'Recent changes across news, documents, categories, and media'
            : 'Recent changes at your scope across news, documents, categories, and media'
        }
      />

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {ENTITY_FILTERS.map((f) => {
          const active = entityFilter === f.value;
          return (
            <button
              key={f.value || 'all'}
              type="button"
              onClick={() => handleEntityFilter(f.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-6 animate-pulse space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded" />
            ))}
          </div>
        ) : (data.events || []).length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No activity yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {Object.entries(grouped).map(([bucket, items]) => (
              items.length > 0 && (
                <section key={bucket} className="px-6 py-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">{bucket}</h3>
                  <ul className="divide-y divide-gray-100">
                    {items.map((ev, i) => (
                      <EventRow
                        key={`${ev.entity_type}-${ev.entity_id}-${ev.kind}-${ev.at}-${i}`}
                        event={ev}
                        onOpen={(link) => navigate(link)}
                      />
                    ))}
                  </ul>
                </section>
              )
            ))}
          </div>
        )}
      </div>

      {data.pagination && data.pagination.totalPages > 1 && (
        <div className="mt-4">
          <Pagination
            page={data.pagination.page}
            totalPages={data.pagination.totalPages}
            total={data.pagination.total}
            limit={data.pagination.limit}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}
