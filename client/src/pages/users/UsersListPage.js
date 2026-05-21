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

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INVITED', label: 'Invited' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

// ── Org cell ──────────────────────────────────────────────────────────────────
function getPrimaryMembership(memberships = []) {
  if (!memberships.length) return null;
  const dept = memberships[0]?.department;
  if (!dept) return null;
  return {
    department: dept.name,
    vertical: dept.vertical?.name || null,
    office: dept.vertical?.officeLocation?.name || null,
    extraCount: Math.max(memberships.length - 1, 0),
  };
}

function OrgCell({ memberships }) {
  const primary = getPrimaryMembership(memberships);
  if (!primary) return <span className="text-gray-400">—</span>;
  const crumbs = [primary.office, primary.vertical].filter(Boolean);
  return (
    <div className="min-w-0">
      {crumbs.length > 0 && (
        <div className="flex items-center gap-0.5 text-[11px] text-gray-400 mb-0.5">
          {crumbs.map((c, i) => (
            <React.Fragment key={c}>
              {i > 0 && <span className="text-gray-300 mx-0.5">›</span>}
              <span className="truncate max-w-[80px]">{c}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-900 truncate">{primary.department}</span>
        {primary.extraCount > 0 && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
            +{primary.extraCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Role / Type cell ──────────────────────────────────────────────────────────
const ROLE_STYLES = {
  employee: 'bg-sky-50 text-sky-700 border border-sky-100',
  category: 'bg-violet-50 text-violet-700 border border-violet-100',
  system:   'bg-amber-50 text-amber-700 border border-amber-100',
  custom:   'bg-gray-100 text-gray-700 border border-gray-200',
};

function RoleTypeCell({ row }) {
  const roleCategory = row.profile?.roleCategory?.name;
  if (roleCategory) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${ROLE_STYLES.category}`}>
        {roleCategory}
      </span>
    );
  }
  const nonEmployeeRole = (row.roleAssignments || []).find((a) => a.role?.code !== 'EMPLOYEE');
  if (nonEmployeeRole?.role) {
    const style = nonEmployeeRole.role.is_system ? ROLE_STYLES.system : ROLE_STYLES.custom;
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${style}`}>
        {nonEmployeeRole.role.name}
      </span>
    );
  }
  const isEmployee = (row.roleAssignments || []).some((a) => a.role?.code === 'EMPLOYEE');
  if (isEmployee) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${ROLE_STYLES.employee}`}>
        Employee
      </span>
    );
  }
  return <span className="text-gray-400 text-xs">—</span>;
}

// ── Summary bar ───────────────────────────────────────────────────────────────
function SummaryBar({ users }) {
  const counts = useMemo(() => {
    const result = { ACTIVE: 0, INVITED: 0, INACTIVE: 0, LOCKED: 0 };
    users.forEach((u) => { if (result[u.status] !== undefined) result[u.status]++; });
    return result;
  }, [users]);

  const items = [
    { label: 'Active',   count: counts.ACTIVE,   color: 'text-emerald-600' },
    { label: 'Invited',  count: counts.INVITED,   color: 'text-amber-600' },
    { label: 'Inactive', count: counts.INACTIVE,  color: 'text-gray-500' },
    { label: 'Locked',   count: counts.LOCKED,    color: 'text-red-500' },
  ].filter((i) => i.count > 0);

  if (!items.length) return null;

  return (
    <div className="flex items-center gap-4 mb-4 px-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-xs">
          <span className={`font-semibold text-sm ${item.color}`}>{item.count}</span>
          <span className="text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function UsersListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [verticalId, setVerticalId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
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
    const vert = (office?.children || []).find((v) => String(v.id) === verticalId);
    return (vert?.children || []).map((d) => ({ value: String(d.id), label: d.name }));
  }, [orgNode, officeId, verticalId]);

  useEffect(() => { setVerticalId(''); setDepartmentId(''); }, [officeId]);
  useEffect(() => { setDepartmentId(''); }, [verticalId]);

  const handleSort = useCallback((col) => {
    setSortDir(sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc');
    setSortBy(col);
    setPage(1);
  }, [sortBy, sortDir, setPage]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit, sort_by: sortBy, sort_dir: sortDir };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (officeId) params.office_location_id = officeId;
      if (verticalId) params.vertical_id = verticalId;
      if (departmentId) params.department_id = departmentId;
      const res = await userService.getUsers(params);
      setData(res.data?.data || { users: [], pagination: {} });
    } catch {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortDir, debouncedSearch, statusFilter, officeId, verticalId, departmentId, addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const columns = [
    {
      key: 'name',
      label: 'Name',
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-semibold text-gray-900 text-sm">{row.first_name} {row.last_name}</div>
          <div className="text-xs text-gray-400 mt-0.5">{row.email}</div>
        </div>
      ),
    },
    {
      key: 'org',
      label: 'Department',
      render: (row) => <OrgCell memberships={row.departmentMemberships} />,
    },
    {
      key: 'role_type',
      label: 'Role',
      render: (row) => <RoleTypeCell row={row} />,
    },
    {
      key: 'profession',
      label: 'Job Title',
      sortable: true,
      render: (row) => (
        <span className="text-sm text-gray-600">{row.profile?.job_title || <span className="text-gray-400">—</span>}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'created_at',
      label: 'Joined',
      sortable: true,
      render: (row) => {
        const date = row.createdAt || row.created_at;
        return <span className="text-xs text-gray-500 whitespace-nowrap">{date ? formatDate(date) : '—'}</span>;
      },
    },
  ];

  const total = data.pagination?.total ?? data.users.length;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${total > 0 ? `${total} users` : 'All users'} and employees`}
        actions={<Button onClick={() => navigate('/users/create')}>Create User</Button>}
      />

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="md:col-span-2">
          <SearchBar value={search} onChange={setSearch} placeholder="Search by name or email…" />
        </div>
        <Select name="status" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          placeholder="All statuses" options={STATUS_OPTIONS} />
        <Select name="office" value={officeId} onChange={(e) => setOfficeId(e.target.value)}
          placeholder="All offices" options={officeOptions} />
        <Select name="vertical" value={verticalId} onChange={(e) => setVerticalId(e.target.value)}
          placeholder="All verticals" options={verticalOptions} disabled={!officeId} />
      </div>
      {verticalId && (
        <div className="mb-3 max-w-xs">
          <Select name="department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}
            placeholder="All departments" options={departmentOptions} />
        </div>
      )}

      {/* Status summary */}
      {!loading && <SummaryBar users={data.users} />}

      <Table
        columns={columns}
        data={data.users}
        loading={loading}
        emptyMessage="No users found"
        sortBy={sortBy}
        sortOrder={sortDir}
        onSort={handleSort}
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
