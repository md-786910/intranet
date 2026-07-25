import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import OrgNodeFilterSelect from '../../components/common/OrgNodeFilterSelect';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { formatDate } from '../../utils/formatters';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function getPrimaryMembership(memberships = []) {
  if (memberships.length === 0) return null;
  const department = memberships[0]?.department;
  if (!department) return null;
  return {
    department: department.name,
    vertical: department.vertical?.name || null,
    office: department.vertical?.officeLocation?.name || null,
    extraCount: Math.max(memberships.length - 1, 0),
  };
}

function OrgCell({ memberships }) {
  const primary = getPrimaryMembership(memberships);
  if (!primary) {
    return <span className="text-gray-400 text-sm">—</span>;
  }
  const parentPath = [primary.office, primary.vertical].filter(Boolean);
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
        <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">
          {primary.department}
        </div>
      </div>
      {primary.extraCount > 0 && (
        <span
          className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100"
          title={`${primary.extraCount} additional assignment${primary.extraCount > 1 ? 's' : ''}`}
        >
          +{primary.extraCount}
        </span>
      )}
    </div>
  );
}

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage, setLimit } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const debouncedSearch = useDebounce(search);
  const [searchParams, setSearchParams] = useSearchParams();
  const nodeId = searchParams.get('node_id') || '';
  const [data, setData] = useState({ employees: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const setNodeId = useCallback((nextId) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (nextId) next.set('node_id', String(nextId));
      else next.delete('node_id');
      return next;
    });
    setPage(1);
  }, [setSearchParams, setPage]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (nodeId) {
        params.node_id = nodeId;
        params.include_subtree = true;
      }
      const res = await employeeService.listEmployees(params);
      setData(res.data?.data || { employees: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, nodeId, addToast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

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
        title="Manage Employees"
        subtitle="Invite and manage employees and their organisation tree assignments."
        actions={<Button onClick={() => navigate('/employees/create')}>Invite Employee</Button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <div className="md:col-span-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email..." />
        </div>
        <Select
          name="status"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          placeholder="All statuses"
          options={STATUS_OPTIONS}
        />
        <OrgNodeFilterSelect
          value={nodeId}
          onChange={(e) => setNodeId(e.target.value)}
        />
      </div>

      <Table
        columns={columns}
        data={data.employees}
        loading={loading}
        emptyMessage="No employees found"
        onRowClick={(row) => navigate(`/employees/${row.user_id}`)}
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
