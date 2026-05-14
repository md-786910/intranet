import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { announcementService } from '../../services/announcementService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermission } from '../../hooks/usePermission';
import { useAuth } from '../../hooks/useAuth';
import { formatDate, formatDateTime, formatRelativeTime } from '../../utils/formatters';

function nameOf(user) {
  if (!user) return null;
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : (user.email || null);
}

function latestAction(row) {
  if (row.status === 'PUBLISHED' && row.publisher && row.published_at) {
    return { label: 'Published', actor: row.publisher, at: row.published_at };
  }
  if (row.status === 'ARCHIVED' && row.archiver && row.archived_at) {
    return { label: 'Archived', actor: row.archiver, at: row.archived_at };
  }
  if (row.status === 'DRAFT' && row.unpublisher && row.unpublished_at) {
    return { label: 'Unpublished', actor: row.unpublisher, at: row.unpublished_at };
  }
  if (row.updater && row.updated_at && row.updated_at !== row.created_at) {
    return { label: 'Updated', actor: row.updater, at: row.updated_at };
  }
  return null;
}

const STATUS_TABS = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function AnnouncementsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  // Authorize against NEWS module — announcement routes use NEWS permissions.
  const { hasPermission: canCreate } = usePermission('NEWS', 'CREATE');
  const { hasPermission: canDelete } = usePermission('NEWS', 'DELETE');
  const { isOwner } = useAuth();
  const { page, limit, setPage } = usePagination();
  const [viewMode, setViewMode] = useState('active');
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ALL');
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ announcements: [], pagination: {}, status_counts: {} });
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isTrash = viewMode === 'trash';

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusTab !== 'ALL') params.status = statusTab;
      if (isTrash) params.trash = true;
      const res = await announcementService.list(params);
      setData(res.data?.data || { announcements: [], pagination: {}, status_counts: {} });
    } catch (err) {
      addToast('Failed to load announcements', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusTab, isTrash, addToast]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleTrash = () => {
    setViewMode((m) => (m === 'trash' ? 'active' : 'trash'));
    setPage(1);
  };

  const askRestore = (row) => setPendingAction({
    title: 'Restore announcement',
    message: `Restore "${row.title}"?`,
    confirmLabel: 'Restore',
    confirmVariant: 'primary',
    run: async () => {
      await announcementService.bulkRestore([row.announcement_item_id]);
      addToast(`Restored "${row.title}"`, 'success');
      fetchItems();
    },
  });

  const askPurge = (row) => setPendingAction({
    title: 'Delete forever',
    message: `Permanently delete "${row.title}"? This cannot be undone.`,
    confirmLabel: 'Delete forever',
    confirmVariant: 'danger',
    run: async () => {
      await announcementService.bulkPurge([row.announcement_item_id]);
      addToast(`Permanently deleted "${row.title}"`, 'success');
      fetchItems();
    },
  });

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setActionLoading(true);
    try {
      await pendingAction.run();
      setPendingAction(null);
    } catch (err) {
      addToast(err.response?.data?.message || 'Action failed', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const activeColumns = [
    { key: 'title', label: 'Title', render: (row) => (
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900">{row.title}</span>
          <PriorityBadge priority={row.priority || 'NORMAL'} hideOnNormal />
          {row.show_in_marquee && (
            <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
              Marquee
            </span>
          )}
        </div>
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'author', label: 'Author', render: (row) => {
      const action = latestAction(row);
      return (
        <div className="leading-tight">
          <div className="text-gray-700">{nameOf(row.author) || <span className="text-gray-400">—</span>}</div>
          {action && (
            <div className="text-xs text-gray-500 mt-0.5">
              {action.label} by {nameOf(action.actor) || 'someone'} · {formatRelativeTime(action.at)}
            </div>
          )}
        </div>
      );
    }},
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDateTime(row.created_at)}</span>
    )},
  ];

  const trashColumns = [
    { key: 'title', label: 'Title', render: (row) => (
      <div className="font-medium text-gray-900">{row.title}</div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'deleted_at', label: 'Archived', render: (row) => (
      <span className="text-gray-500">{formatDate(row.deleted_at)}</span>
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
        {canDelete && (
          <>
            <button
              type="button"
              onClick={() => askRestore(row)}
              className="text-primary-600 hover:text-primary-700 text-xs font-medium"
            >
              Restore
            </button>
            <button
              type="button"
              onClick={() => askPurge(row)}
              className="text-red-600 hover:text-red-700 text-xs font-medium"
            >
              Delete forever
            </button>
          </>
        )}
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title={isTrash ? 'Announcements — Archive' : 'Announcements'}
        subtitle={
          isTrash
            ? 'Archived announcements can be restored or permanently deleted'
            : isOwner
              ? 'Manage announcements'
              : 'Showing announcements at your scope. Platform Owner can see all.'
        }
        actions={
          <div className="flex gap-2">
            {!isTrash && canCreate && (
              <Button onClick={() => navigate('/announcements/create')}>Create Announcement</Button>
            )}
            {canDelete && (
              <Button variant={isTrash ? 'primary' : 'secondary'} onClick={toggleTrash}>
                {isTrash ? 'Back to announcements' : 'Archive'}
              </Button>
            )}
          </div>
        }
      />

      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => {
          const active = statusTab === tab;
          const count = data.status_counts?.[tab];
          return (
            <button
              key={tab}
              onClick={() => { setStatusTab(tab); setPage(1); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <span>{tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}</span>
              {typeof count === 'number' && (
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full text-xs font-semibold ${
                  active ? 'bg-primary-100 text-primary-700' : 'bg-gray-200 text-gray-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex gap-4 mb-4">
        <div className="w-72">
          <SearchBar value={search} onChange={setSearch} placeholder={isTrash ? 'Search archive...' : 'Search announcements...'} />
        </div>
      </div>

      <Table
        columns={isTrash ? trashColumns : activeColumns}
        data={data.announcements}
        loading={loading}
        emptyMessage={isTrash
          ? (search ? 'No archived announcements match the filter' : 'Archive is empty')
          : 'No announcements found'}
        onRowClick={isTrash ? undefined : (row) => navigate(`/announcements/${row.announcement_item_id}`)}
      />
      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={data.pagination.limit}
        onPageChange={setPage}
      />

      <ConfirmDialog
        isOpen={Boolean(pendingAction)}
        onCancel={() => setPendingAction(null)}
        onConfirm={handleConfirm}
        loading={actionLoading}
        title={pendingAction?.title || 'Confirm'}
        message={pendingAction?.message || ''}
        confirmLabel={pendingAction?.confirmLabel || 'Confirm'}
        confirmVariant={pendingAction?.confirmVariant || 'primary'}
      />
    </div>
  );
}
