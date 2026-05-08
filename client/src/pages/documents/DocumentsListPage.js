import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import PriorityBadge from '../../components/common/PriorityBadge';
import Select from '../../components/common/Select';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermission } from '../../hooks/usePermission';
import { formatDate, formatDateTime } from '../../utils/formatters';

const STATUS_TABS = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function DocumentsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canCreateDocuments } = usePermission('DOCUMENTS', 'CREATE');
  const { hasPermission: canDeleteDocuments } = usePermission('DOCUMENTS', 'DELETE');
  const { page, limit, setPage } = usePagination();
  const [viewMode, setViewMode] = useState('active');
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ALL');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ documents: [], pagination: {}, status_counts: {} });
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const isTrash = viewMode === 'trash';

  useEffect(() => {
    documentService.getCategories()
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, []);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusTab !== 'ALL') params.status = statusTab;
      if (categoryFilter) params.category_id = categoryFilter;
      if (isTrash) params.trash = true;
      const res = await documentService.getDocuments(params);
      setData(res.data?.data || { documents: [], pagination: {}, status_counts: {} });
    } catch (err) {
      addToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusTab, categoryFilter, isTrash, addToast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const toggleTrash = () => {
    setViewMode((m) => (m === 'trash' ? 'active' : 'trash'));
    setPage(1);
  };

  const askRestore = (row) => setPendingAction({
    title: 'Restore document',
    message: `Restore "${row.title}"? It will return to its previous state in the active list.`,
    confirmLabel: 'Restore',
    confirmVariant: 'primary',
    run: async () => {
      await documentService.bulkRestore([row.document_item_id]);
      addToast(`Restored "${row.title}"`, 'success');
      fetchDocs();
    },
  });

  const askPurge = (row) => setPendingAction({
    title: 'Delete forever',
    message: `Permanently delete "${row.title}"? Versions and audience rules go with it. This cannot be undone.`,
    confirmLabel: 'Delete forever',
    confirmVariant: 'danger',
    run: async () => {
      await documentService.bulkPurge([row.document_item_id]);
      addToast(`Permanently deleted "${row.title}"`, 'success');
      fetchDocs();
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
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{row.title}</span>
        <PriorityBadge priority={row.priority || 'NORMAL'} hideOnNormal />
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'category', label: 'Category', render: (row) => (
      <span className="text-gray-500">{row.category?.name || '—'}</span>
    )},
    { key: 'author', label: 'Author', render: (row) => (
      <span className="text-gray-500">{row.author?.first_name} {row.author?.last_name}</span>
    )},
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDateTime(row.created_at)}</span>
    )},
  ];

  const trashColumns = [
    { key: 'title', label: 'Title', render: (row) => (
      <div className="flex items-center gap-2">
        <span className="font-medium text-gray-900">{row.title}</span>
        <PriorityBadge priority={row.priority || 'NORMAL'} hideOnNormal />
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'category', label: 'Category', render: (row) => (
      <span className="text-gray-500">{row.category?.name || '—'}</span>
    )},
    { key: 'deleted_at', label: 'Archived', render: (row) => (
      <span className="text-gray-500">{formatDate(row.deleted_at)}</span>
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex justify-end gap-3" onClick={(e) => e.stopPropagation()}>
        {canDeleteDocuments && (
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
        title={isTrash ? 'Documents — Archive' : 'Documents'}
        subtitle={isTrash ? 'Archived documents can be restored or permanently deleted' : 'Manage documents and files'}
        actions={
          <div className="flex gap-2">
            {!isTrash && canCreateDocuments && (
              <Button onClick={() => navigate('/documents/create')}>Upload Document</Button>
            )}
            {canDeleteDocuments && (
              <Button
                variant={isTrash ? 'primary' : 'secondary'}
                onClick={toggleTrash}
                icon={
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                }
              >
                {isTrash ? 'Back to documents' : 'Archive'}
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
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder={isTrash ? 'Search archive...' : 'Search documents...'}
          />
        </div>
        {!isTrash && (
          <div className="w-48">
            <Select name="category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
              placeholder="All categories"
              options={categories.map((c) => ({ value: c.category_id, label: c.name }))}
            />
          </div>
        )}
      </div>

      <Table
        columns={isTrash ? trashColumns : activeColumns}
        data={data.documents}
        loading={loading}
        emptyMessage={isTrash
          ? (search ? 'No archived documents match the filter' : 'Archive is empty')
          : 'No documents found'}
        onRowClick={isTrash ? undefined : (row) => navigate(`/documents/${row.document_item_id}`)}
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
