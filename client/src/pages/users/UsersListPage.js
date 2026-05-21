import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import StatusBadge from '../../components/common/StatusBadge';
import Select from '../../components/common/Select';
import { userService } from '../../services/userService';
import { roleCategoryService } from '../../services/roleCategoryService';
import { jobTitleService } from '../../services/jobTitleService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
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
function OrgCell({ memberships = [], orgName }) {
  if (!memberships.length) return <span className="text-gray-400">—</span>;
  const dept = memberships[0]?.department;
  if (!dept) return <span className="text-gray-400">—</span>;

  const segments = [
    orgName,
    dept.vertical?.officeLocation?.name,
    dept.vertical?.name,
    dept.name,
  ].filter(Boolean);

  const breadcrumbs = segments.slice(0, -1);
  const departmentName = segments[segments.length - 1];
  const extraCount = Math.max(memberships.length - 1, 0);

  return (
    <div className="min-w-0">
      {breadcrumbs.length > 0 && (
        <div className="flex items-center flex-wrap gap-0.5 text-[11px] text-gray-400 mb-0.5 leading-tight">
          {breadcrumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-300 mx-0.5">›</span>}
              <span className="truncate max-w-[90px]">{c}</span>
            </React.Fragment>
          ))}
        </div>
      )}
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-medium text-gray-800 truncate">{departmentName}</span>
        {extraCount > 0 && (
          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600 border border-indigo-100">
            +{extraCount}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Role cells ────────────────────────────────────────────────────────────────
const ROLE_STYLES = {
  employee: 'bg-sky-50 text-sky-700 border border-sky-100',
  category: 'bg-violet-50 text-violet-700 border border-violet-100',
  system:   'bg-amber-50 text-amber-700 border border-amber-100',
  custom:   'bg-gray-100 text-gray-700 border border-gray-200',
};

function RoleCategoryCell({ row }) {
  const name = row.profile?.roleCategory?.name;
  if (!name) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${ROLE_STYLES.category}`}>
      {name}
    </span>
  );
}

function RoleCell({ row }) {
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
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Read all state from URL ──────────────────────────────────────────────
  const page      = Number(searchParams.get('page')     || 1);
  const limit     = Number(searchParams.get('limit')    || 10);
  const search    = searchParams.get('q')               || '';
  const statusFilter   = searchParams.get('status')    || '';
  const officeId       = searchParams.get('office')    || '';
  const verticalId     = searchParams.get('vertical')  || '';
  const departmentId   = searchParams.get('dept')      || '';
  const roleCategoryId = searchParams.get('cat')       || '';
  const roleId         = searchParams.get('role')      || '';
  const jobTitleFilter = searchParams.get('title')     || '';
  const sortBy    = searchParams.get('sort')            || 'name';
  const sortDir   = searchParams.get('dir')             || 'asc';

  const debouncedSearch = useDebounce(search);

  // ── URL writers ──────────────────────────────────────────────────────────
  const setParam = useCallback((updates) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(updates).forEach(([k, v]) => {
        if (v !== '' && v != null) next.set(k, String(v));
        else next.delete(k);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Reset page on any filter change
  const setFilter = useCallback((key, value) => {
    setParam({ [key]: value, page: '' });
  }, [setParam]);

  // ── Reference data ────────────────────────────────────────────────────────
  const { tree } = useOrgTree();
  const [roleCategories, setRoleCategories] = useState([]);
  const [allRoles, setAllRoles] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);

  useEffect(() => {
    roleCategoryService.list().then((r) => setRoleCategories(r.data?.data || [])).catch(() => {});
    roleService.getRoles({ limit: 100 }).then((r) => setAllRoles(r.data?.data?.roles || [])).catch(() => {});
    jobTitleService.list().then((r) => setJobTitles(r.data?.data || [])).catch(() => {});
  }, []);

  // ── Org tree options ──────────────────────────────────────────────────────
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

  // ── Sort handler ──────────────────────────────────────────────────────────
  const handleSort = useCallback((col) => {
    const newDir = sortBy === col ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc';
    setParam({ sort: col, dir: newDir, page: '' });
  }, [sortBy, sortDir, setParam]);

  // ── Data fetch ────────────────────────────────────────────────────────────
  const [data, setData] = useState({ users: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = { page, limit, sort_by: sortBy, sort_dir: sortDir };
      if (debouncedSearch)  params.search             = debouncedSearch;
      if (statusFilter)     params.status             = statusFilter;
      if (officeId)         params.office_location_id = officeId;
      if (verticalId)       params.vertical_id        = verticalId;
      if (departmentId)     params.department_id      = departmentId;
      if (roleCategoryId)   params.role_category_id   = roleCategoryId;
      if (roleId)           params.role_id            = roleId;
      if (jobTitleFilter)   params.job_title          = jobTitleFilter;
      const res = await userService.getUsers(params);
      setData(res.data?.data || { users: [], pagination: {} });
    } catch {
      addToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, sortBy, sortDir, debouncedSearch, statusFilter, officeId, verticalId, departmentId, roleCategoryId, roleId, jobTitleFilter, addToast]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  // ── Columns ───────────────────────────────────────────────────────────────
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
      render: (row) => <OrgCell memberships={row.departmentMemberships} orgName={orgNode?.name} />,
    },
    {
      key: 'role_category',
      label: 'Role Category',
      render: (row) => <RoleCategoryCell row={row} />,
    },
    {
      key: 'role',
      label: 'Role Permission',
      render: (row) => <RoleCell row={row} />,
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
      key: 'reports_to',
      label: 'Reporting To',
      render: (row) => {
        const m = row.profile?.manager;
        if (!m) return <span className="text-gray-400">—</span>;
        return (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); navigate(`/users/${m.user_id}`); }}
            className="flex items-center gap-1.5 group text-left"
          >
            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-[10px] font-semibold">
              {`${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}`.toUpperCase()}
            </div>
            <span className="text-sm text-gray-700 group-hover:text-primary-600 transition-colors truncate max-w-[110px]">
              {m.first_name} {m.last_name}
            </span>
          </button>
        );
      },
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
  const hasFilters = search || statusFilter || officeId || verticalId || departmentId || roleCategoryId || roleId || jobTitleFilter;

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle={`${total > 0 ? `${total} users` : 'All users'} and employees`}
        actions={<Button onClick={() => navigate('/users/create')}>Create User</Button>}
      />

      {/* Row 1: Search + Status + Office + Vertical */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-3">
        <div className="md:col-span-2">
          <SearchBar value={search} onChange={(v) => setFilter('q', v)} placeholder="Search by name or email…" />
        </div>
        <Select name="status" value={statusFilter}
          onChange={(e) => setFilter('status', e.target.value)}
          placeholder="All statuses" options={STATUS_OPTIONS} />
        <Select name="office" value={officeId}
          onChange={(e) => setParam({ office: e.target.value, vertical: '', dept: '', page: '' })}
          placeholder="All offices" options={officeOptions} />
        <Select name="vertical" value={verticalId}
          onChange={(e) => setParam({ vertical: e.target.value, dept: '', page: '' })}
          placeholder="All verticals" options={verticalOptions} disabled={!officeId} />
      </div>

      {/* Row 2: Department + Role Category + Role Permission + Job Title + Clear */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        {verticalId && (
          <div className="w-48">
            <Select name="department" value={departmentId}
              onChange={(e) => setFilter('dept', e.target.value)}
              placeholder="All departments" options={departmentOptions} />
          </div>
        )}
        {roleCategories.length > 0 && (
          <div className="w-48">
            <Select name="role_category" value={roleCategoryId}
              onChange={(e) => setFilter('cat', e.target.value)}
              placeholder="All role categories"
              options={roleCategories.map((c) => ({ value: String(c.id), label: c.name }))} />
          </div>
        )}
        {allRoles.length > 0 && (
          <div className="w-48">
            <Select name="role" value={roleId}
              onChange={(e) => setFilter('role', e.target.value)}
              placeholder="All role permissions"
              options={allRoles.map((r) => ({ value: String(r.role_id), label: r.name }))} />
          </div>
        )}
        {jobTitles.length > 0 && (
          <div className="w-48">
            <Select name="job_title_filter" value={jobTitleFilter}
              onChange={(e) => setFilter('title', e.target.value)}
              placeholder="All job titles"
              options={jobTitles.map((t) => ({ value: t.name, label: t.name }))} />
          </div>
        )}
        {hasFilters && (
          <button
            type="button"
            onClick={() => setSearchParams({}, { replace: true })}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 border border-gray-300 hover:border-gray-400 rounded-lg px-3 py-2 bg-white hover:bg-gray-50 transition-colors whitespace-nowrap"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>

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
        page={data.pagination.page || page}
        totalPages={data.pagination.totalPages || 1}
        total={data.pagination.total || 0}
        limit={limit}
        onPageChange={(p) => setParam({ page: p })}
        onLimitChange={(l) => setParam({ limit: l, page: '' })}
      />
    </div>
  );
}
