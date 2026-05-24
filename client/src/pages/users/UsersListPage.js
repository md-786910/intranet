import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
import { useOrgTree } from '../../hooks/useOrgTree';
import { formatDate } from '../../utils/formatters';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function OrgCell({ memberships = [] }) {
  if (memberships.length === 0) return <span className="text-gray-400 text-sm">—</span>;
  const primary = memberships.find((m) => m.is_primary) || memberships[0];
  const dept = primary?.department;
  if (!dept) return <span className="text-gray-400 text-sm">—</span>;
  const parentPath = [dept.vertical?.officeLocation?.name, dept.vertical?.name].filter(Boolean);
  const extraCount = memberships.length - 1;
  return (
    <div className="flex items-start gap-2 min-w-0">
      <div className="min-w-0 leading-tight">
        {parentPath.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
            {parentPath.map((part, idx) => (
              <React.Fragment key={`${part}-${idx}`}>
                {idx > 0 && <span className="text-gray-300">›</span>}
                <span className="truncate">{part}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">{dept.name}</div>
      </div>
      {extraCount > 0 && (
        <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
          +{extraCount}
        </span>
      )}
    </div>
  );
}

export default function UsersListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ users: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const { tree } = useOrgTree();

  const orgNode = tree[0] || null;
  const officeOptions = useMemo(
    () => (orgNode?.children || []).map((o) => ({ value: String(o.id), label: o.name })),
    [orgNode],
  );
  const verticalOptions = useMemo(() => {
    if (!officeId) return [];
    const office = (orgNode?.children || []).find((o) => String(o.id) === officeId);
    return (office?.children || []).map((v) => ({ value: String(v.id), label: v.name }));
  }, [orgNode, officeId]);
  const departmentOptions = useMemo(() => {
    if (!verticalId) return [];
    const office = (orgNode?.children || []).find((o) => String(o.id) === officeId);
    const vertical = (office?.children || []).find((v) => String(v.id) === verticalId);
    return (vertical?.children || []).map((d) => ({ value: String(d.id), label: d.name }));
  }, [orgNode, officeId, verticalId]);

  useEffect(() => { setVerticalId(''); setDepartmentId(''); }, [officeId]);
  useEffect(() => { setDepartmentId(''); }, [verticalId]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit, scope_type: 'ORGANISATION', scope_id: currentOrganisationId };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (officeId) params.office_location_id = officeId;
      if (verticalId) params.vertical_id = verticalId;
      if (departmentId) params.department_id = departmentId;
      const res = await userService.getUsers(params);
      setData(res.data?.data || { users: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, officeId, verticalId, departmentId, addToast, currentOrganisationId]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.first_name} {row.last_name}</div>
        <div className="text-xs text-gray-500">{row.email}</div>
      </div>
    )},
    { key: 'org', label: 'Organisation', render: (row) => (
      <OrgCell memberships={row.departmentMemberships} />
    )},
    { key: 'job', label: 'Job Title', render: (row) => (
      <span className="text-gray-500">{row.profile?.job_title || '—'}</span>
    )},
    { key: 'role_category', label: 'Role', render: (row) => (
      row.profile?.roleCategory?.name
        ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium">{row.profile.roleCategory.name}</span>
        : <span className="text-gray-400">—</span>
    )},
    { key: 'status', label: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_at', label: 'Created', render: (row) => (
      <span className="text-gray-500">{formatDate(row.created_at)}</span>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and employees"
        actions={<Button onClick={() => navigate('/users/create')}>Create User</Button>}
      />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
        <div className="md:col-span-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." />
        </div>
        <Select name="status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          placeholder="All statuses" options={STATUS_OPTIONS} />
        <Select name="office" value={officeId} onChange={(e) => setOfficeId(e.target.value)}
          placeholder="All offices" options={officeOptions} />
        <Select name="vertical" value={verticalId} onChange={(e) => setVerticalId(e.target.value)}
          placeholder="All verticals" options={verticalOptions} disabled={!officeId} />
      </div>
      {verticalId && (
        <div className="mb-4 max-w-xs">
          <Select name="department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            placeholder="All departments" options={departmentOptions} />
        </div>
      )}
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
