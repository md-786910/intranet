import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import { newsService } from '../../services/newsService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { usePermission } from '../../hooks/usePermission';
import { formatDate, truncate } from '../../utils/formatters';
const STATUS_TABS = ['ALL', 'DRAFT', 'PUBLISHED', 'ARCHIVED'];

export default function NewsListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { hasPermission: canCreateNews } = usePermission('NEWS', 'CREATE');
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('ALL');
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ articles: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const fetchArticles = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusTab !== 'ALL') params.status = statusTab;
      const res = await newsService.getArticles(params);
      setData(res.data?.data || { articles: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load news', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusTab, addToast]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const columns = [
    { key: 'title', label: 'Title', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.title}</div>
        {row.summary && <div className="text-xs text-gray-500 mt-0.5">{truncate(row.summary, 80)}</div>}
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
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
        title="News"
        subtitle="Manage news articles"
        actions={canCreateNews ? <Button onClick={() => navigate('/news/create')}>Create Article</Button> : null}
      />
      {/* Status tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => { setStatusTab(tab); setPage(1); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              statusTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'ALL' ? 'All' : tab.charAt(0) + tab.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      <div className="mb-4 max-w-sm">
        <SearchBar value={search} onChange={setSearch} placeholder="Search articles..." />
      </div>
      <Table
        columns={columns}
        data={data.articles}
        loading={loading}
        emptyMessage="No articles found"
        onRowClick={(row) => navigate(`/news/${row.news_item_id}`)}
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
