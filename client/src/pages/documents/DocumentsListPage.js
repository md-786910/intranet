import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import { documentService } from '../../services/documentService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';

const DEFAULT_ORGANISATION_ID = 1;

export default function DocumentsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [categories, setCategories] = useState([]);
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ documents: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    documentService.getCategories({ scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => setCategories(res.data?.data || []))
      .catch(() => {});
  }, []);

  const fetchDocs = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit, scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (categoryFilter) params.category_id = categoryFilter;
      const res = await documentService.getDocuments(params);
      setData(res.data?.data || { documents: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, categoryFilter, addToast]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const columns = [
    { key: 'title', label: 'Title', render: (row) => (
      <span className="font-medium text-gray-900">{row.title}</span>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'category', label: 'Category', render: (row) => (
      <span className="text-gray-500">{row.category?.name || '—'}</span>
    )},
    { key: 'author', label: 'Author', render: (row) => (
      <span className="text-gray-500">{row.author?.first_name} {row.author?.last_name}</span>
    )},
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDate(row.created_at)}</span>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Documents"
        subtitle="Manage documents and files"
        actions={<Button onClick={() => navigate('/documents/create')}>Upload Document</Button>}
      />
      <div className="flex gap-4 mb-4">
        <div className="w-72"><SearchBar value={search} onChange={setSearch} placeholder="Search documents..." /></div>
        <div className="w-40">
          <Select name="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'PUBLISHED', label: 'Published' },
              { value: 'ARCHIVED', label: 'Archived' },
            ]}
          />
        </div>
        <div className="w-48">
          <Select name="category" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}
            placeholder="All categories"
            options={categories.map((c) => ({ value: c.category_id, label: c.name }))}
          />
        </div>
      </div>
      <Table
        columns={columns}
        data={data.documents}
        loading={loading}
        emptyMessage="No documents found"
        onRowClick={(row) => navigate(`/documents/${row.document_item_id}`)}
      />
      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={data.pagination.limit}
        onPageChange={setPage}
      />
    </div>
  );
}
