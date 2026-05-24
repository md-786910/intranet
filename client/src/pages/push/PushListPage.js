import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import StatusBadge from '../../components/common/StatusBadge';
import { pushService } from '../../services/pushService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { formatDate } from '../../utils/formatters';

const DEFAULT_ORGANISATION_ID = 1;

export default function PushListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage, setLimit } = usePagination();
  const [data, setData] = useState({ campaigns: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const res = await pushService.getCampaigns({ page, limit, scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID });
      setData(res.data?.data || { campaigns: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load campaigns', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, addToast]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  const columns = [
    { key: 'title', label: 'Title', render: (row) => (
      <span className="font-medium text-gray-900">{row.title}</span>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'creator', label: 'Created By', render: (row) => (
      <span className="text-gray-500">{row.creator?.first_name} {row.creator?.last_name}</span>
    )},
    { key: 'recipient_count', label: 'Recipients', render: (row) => (
      <span className="text-gray-500">{row.recipient_count || 0}</span>
    )},
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDate(row.created_at)}</span>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Push Notifications"
        subtitle="Manage push campaigns"
        actions={<Button onClick={() => navigate('/push/create')}>Create Campaign</Button>}
      />
      <Table
        columns={columns}
        data={data.campaigns}
        loading={loading}
        emptyMessage="No campaigns found"
        onRowClick={(row) => navigate(`/push/${row.push_campaign_id}`)}
      />
      <Pagination
        page={data.pagination.page}
        totalPages={data.pagination.totalPages}
        total={data.pagination.total}
        limit={data.pagination.limit}
        onPageChange={setPage}
        onLimitChange={(val) => { setLimit(val); setPage(1); }}
      />
    </div>
  );
}
