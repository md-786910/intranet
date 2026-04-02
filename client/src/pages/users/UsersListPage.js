import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import { userService } from '../../services/userService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';
import { usePermission } from '../../hooks/usePermission';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

export default function UsersListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ users: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const { hasPermission: canManageUsers } = usePermission('ADMIN', 'MANAGE_USERS');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit, scope_type: 'ORGANISATION', scope_id: currentOrganisationId };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      const res = await userService.getUsers(params);
      setData(res.data?.data || { users: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, addToast, currentOrganisationId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.first_name} {row.last_name}</div>
        <div className="text-xs text-gray-500">{row.email}</div>
      </div>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'profile', label: 'Job Title', render: (row) => (
      <span className="text-gray-500">{row.profile?.job_title || '—'}</span>
    )},
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDate(row.created_at)}</span>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage user accounts"
        actions={<Button onClick={() => navigate('/users/create')}>Create User</Button>}
      />
      <div className="flex gap-4 mb-4">
        <div className="w-72">
          <SearchBar value={search} onChange={setSearch} placeholder="Search users..." />
        </div>
        <div className="w-40">
          <Select
            name="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            placeholder="All statuses"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'LOCKED', label: 'Locked' },
            ]}
          />
        </div>
      </div>
      <Table
        columns={columns}
        data={data.users}
        loading={loading}
        emptyMessage="No users found"
        onRowClick={(row) => navigate(`/users/${row.user_id}`)}
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
