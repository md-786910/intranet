import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import { useOrgTree } from '../../hooks/useOrgTree';
import { formatDate } from '../../utils/formatters';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function summarizeMemberships(memberships = []) {
  if (memberships.length === 0) return '—';
  const first = memberships[0]?.department;
  if (!first) return '—';
  const path = [first.name, first.vertical?.name, first.vertical?.officeLocation?.name]
    .filter(Boolean).join(' · ');
  return memberships.length > 1 ? `${path} +${memberships.length - 1}` : path;
}

export default function EmployeesListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const debouncedSearch = useDebounce(search);
  const [data, setData] = useState({ employees: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const { tree } = useOrgTree();

  const orgNode = tree[0] || null;
  const officeOptions = useMemo(
    () => (orgNode?.children || []).map((office) => ({ value: String(office.id), label: office.name })),
    [orgNode],
  );
  const verticalOptions = useMemo(() => {
    if (!officeId) return [];
    const office = (orgNode?.children || []).find((item) => String(item.id) === officeId);
    return (office?.children || []).map((vertical) => ({ value: String(vertical.id), label: vertical.name }));
  }, [orgNode, officeId]);
  const departmentOptions = useMemo(() => {
    if (!verticalId) return [];
    const office = (orgNode?.children || []).find((item) => String(item.id) === officeId);
    const vertical = (office?.children || []).find((item) => String(item.id) === verticalId);
    return (vertical?.children || []).map((department) => ({ value: String(department.id), label: department.name }));
  }, [orgNode, officeId, verticalId]);

  useEffect(() => { setVerticalId(''); setDepartmentId(''); }, [officeId]);
  useEffect(() => { setDepartmentId(''); }, [verticalId]);

  const fetchEmployees = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (officeId) params.office_location_id = officeId;
      if (verticalId) params.vertical_id = verticalId;
      if (departmentId) params.department_id = departmentId;
      const res = await employeeService.listEmployees(params);
      setData(res.data?.data || { employees: [], pagination: {} });
    } catch (err) {
      addToast('Failed to load employees', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, statusFilter, officeId, verticalId, departmentId, addToast]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const columns = [
    { key: 'name', label: 'Name', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.first_name} {row.last_name}</div>
        <div className="text-xs text-gray-500">{row.email}</div>
      </div>
    )},
    { key: 'org', label: 'Department · Vertical · Office', render: (row) => (
      <span className="text-gray-600 text-sm">{summarizeMemberships(row.departmentMemberships)}</span>
    )},
    { key: 'job', label: 'Job Title', render: (row) => (
      <span className="text-gray-500">{row.profile?.job_title || '—'}</span>
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
      />
    </div>
  );
}
