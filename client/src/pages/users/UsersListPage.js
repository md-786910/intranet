import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import PageHeader from "../../components/common/PageHeader";
import Button from "../../components/common/Button";
import Table from "../../components/common/Table";
import Pagination from "../../components/common/Pagination";
import SearchBar from "../../components/common/SearchBar";
import StatusBadge from "../../components/common/StatusBadge";
import Select from "../../components/common/Select";
import { userService } from "../../services/userService";
import { useToast } from "../../hooks/useToast";
import { usePagination } from "../../hooks/usePagination";
import { useDebounce } from "../../hooks/useDebounce";
import { useOrgTree } from "../../hooks/useOrgTree";
import { formatDate } from "../../utils/formatters";
import { useCurrentOrganisation } from "../../hooks/useCurrentOrganisation";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "Active" },
  { value: "INVITED", label: "Invited" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "LOCKED", label: "Locked" },
];

const SCOPE_PRIORITY = [
  "ORGANISATION",
  "OFFICE_LOCATION",
  "VERTICAL",
  "DEPARTMENT",
];

function resolveScopeLabel(assignment, orgNode) {
  if (!assignment || !orgNode) return null;
  switch (assignment.scope_type) {
    case "ORGANISATION":
      return { path: [], name: orgNode.name };
    case "OFFICE_LOCATION": {
      // eslint-disable-next-line eqeqeq
      const office = (orgNode.children || []).find(
        (o) => o.id == assignment.scope_id,
      );
      return office ? { path: [orgNode.name], name: office.name } : null;
    }
    case "VERTICAL": {
      for (const office of orgNode.children || []) {
        // eslint-disable-next-line eqeqeq
        const vertical = (office.children || []).find(
          (v) => v.id == assignment.scope_id,
        );
        if (vertical)
          return { path: [orgNode.name, office.name], name: vertical.name };
      }
      return null;
    }
    default:
      return null;
  }
}

function OrgCell({ memberships = [], roleAssignments = [], orgNode = null }) {
  if (memberships.length === 0) {
    const sorted = [...roleAssignments].sort(
      (a, b) =>
        SCOPE_PRIORITY.indexOf(a.scope_type) -
        SCOPE_PRIORITY.indexOf(b.scope_type),
    );
    const primary = sorted[0];
    const resolved = primary ? resolveScopeLabel(primary, orgNode) : null;
    if (!resolved) return <span className="text-gray-400 text-sm">—</span>;
    return (
      <div className="min-w-0 leading-tight">
        {resolved.path.length > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
            {resolved.path.map((part, idx) => (
              <React.Fragment key={`${part}-${idx}`}>
                {idx > 0 && <span className="text-gray-300">›</span>}
                <span className="truncate">{part}</span>
              </React.Fragment>
            ))}
          </div>
        )}
        <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">
          {resolved.name}
        </div>
      </div>
    );
  }

  const primary = memberships.find((m) => m.is_primary) || memberships[0];
  const dept = primary?.department;
  if (!dept) return <span className="text-gray-400 text-sm">—</span>;
  const parentPath = [
    dept.vertical?.officeLocation?.name,
    dept.vertical?.name,
  ].filter(Boolean);
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
        <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">
          {dept.name}
        </div>
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
  const { page, limit, setPage, setLimit } = usePagination();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [verticalId, setVerticalId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const debouncedSearch = useDebounce(search);
  const [searchParams, setSearchParams] = useSearchParams();
  const sortBy  = searchParams.get('sort')  || 'created_at';
  const sortDir = searchParams.get('order') || 'desc';
  const [data, setData] = useState({ users: [], pagination: {} });
  const [loading, setLoading] = useState(true);
  const { tree } = useOrgTree();

  const orgNode = tree[0] || null;
  const officeOptions = useMemo(
    () =>
      (orgNode?.children || []).map((o) => ({
        value: String(o.id),
        label: o.name,
      })),
    [orgNode],
  );
  const verticalOptions = useMemo(() => {
    if (!officeId) return [];
    const office = (orgNode?.children || []).find(
      (o) => String(o.id) === officeId,
    );
    return (office?.children || []).map((v) => ({
      value: String(v.id),
      label: v.name,
    }));
  }, [orgNode, officeId]);
  const departmentOptions = useMemo(() => {
    if (!verticalId) return [];
    const office = (orgNode?.children || []).find(
      (o) => String(o.id) === officeId,
    );
    const vertical = (office?.children || []).find(
      (v) => String(v.id) === verticalId,
    );
    return (vertical?.children || []).map((d) => ({
      value: String(d.id),
      label: d.name,
    }));
  }, [orgNode, officeId, verticalId]);

  useEffect(() => {
    setVerticalId("");
    setDepartmentId("");
  }, [officeId]);
  useEffect(() => {
    setDepartmentId("");
  }, [verticalId]);

  const handleSort = useCallback((col) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      const currentSort  = prev.get('sort');
      const currentOrder = prev.get('order') || 'asc';
      if (currentSort !== col) {
        next.set('sort', col);
        next.set('order', 'asc');
      } else if (currentOrder === 'asc') {
        next.set('order', 'desc');
      } else {
        next.delete('sort');
        next.delete('order');
      }
      next.set('page', '1');
      return next;
    });
    setPage(1);
  }, [setSearchParams, setPage]);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page,
        limit,
        scope_type: "ORGANISATION",
        scope_id: currentOrganisationId,
        sort_by: sortBy,
        sort_dir: sortDir,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (statusFilter) params.status = statusFilter;
      if (officeId) params.office_location_id = officeId;
      if (verticalId) params.vertical_id = verticalId;
      if (departmentId) params.department_id = departmentId;
      const res = await userService.getUsers(params);
      setData(res.data?.data || { users: [], pagination: {} });
    } catch (err) {
      addToast("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [
    page,
    limit,
    debouncedSearch,
    statusFilter,
    officeId,
    verticalId,
    departmentId,
    sortBy,
    sortDir,
    addToast,
    currentOrganisationId,
  ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (row) => (
        <div>
          <div className="font-medium text-gray-900">
            {row.first_name} {row.last_name}
          </div>
          <div className="text-xs text-gray-500">{row.email}</div>
        </div>
      ),
    },
    {
      key: "org",
      label: "Organisation",
      render: (row) => (
        <OrgCell
          memberships={row.departmentMemberships}
          roleAssignments={row.roleAssignments}
          orgNode={orgNode}
        />
      ),
    },
    {
      key: "job_title",
      label: "Job Title",
      sortable: true,
      render: (row) => (
        <span className="text-gray-500">{row.profile?.job_title || "—"}</span>
      ),
    },
    {
      key: "permission",
      label: "Permission",
      sortable: true,
      render: (row) => {
        const sorted = [...(row.roleAssignments || [])].sort(
          (a, b) =>
            SCOPE_PRIORITY.indexOf(a.scope_type) -
            SCOPE_PRIORITY.indexOf(b.scope_type),
        );
        const primary = sorted[0]?.role;
        return primary ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium">
            {primary.name}
          </span>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      label: "Created",
      render: (row) => (
        <span className="text-gray-500">
          {formatDate(row.createdAt || row.created_at)}
        </span>
      ),
    },
  ];

  const hasActiveFilters = search || statusFilter || officeId || verticalId || departmentId;

  const clearAllFilters = useCallback(() => {
    setSearch('');
    setStatusFilter('');
    setOfficeId('');
    setVerticalId('');
    setDepartmentId('');
    setPage(1);
  }, [setPage]);

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Manage user accounts and employees"
        actions={
          <Button onClick={() => navigate("/users/create")}>Create User</Button>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-2">
        <div className="md:col-span-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search by name or email..."
          />
        </div>
        <div className="relative">
          <Select
            name="status"
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            placeholder="All statuses"
            options={STATUS_OPTIONS}
          />
          {statusFilter && (
            <button
              onClick={() => { setStatusFilter(''); setPage(1); }}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="relative">
          <Select
            name="office"
            value={officeId}
            onChange={(e) => setOfficeId(e.target.value)}
            placeholder="All offices"
            options={officeOptions}
          />
          {officeId && (
            <button
              onClick={() => setOfficeId('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="relative">
          <Select
            name="vertical"
            value={verticalId}
            onChange={(e) => setVerticalId(e.target.value)}
            placeholder="All verticals"
            options={verticalOptions}
            disabled={!officeId}
          />
          {verticalId && (
            <button
              onClick={() => setVerticalId('')}
              className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              title="Clear"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 mb-4">
        {verticalId && (
          <div className="relative w-48">
            <Select
              name="department"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              placeholder="All departments"
              options={departmentOptions}
            />
            {departmentId && (
              <button
                onClick={() => setDepartmentId('')}
                className="absolute right-8 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title="Clear"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
        {hasActiveFilters && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-red-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear filters
          </button>
        )}
      </div>
      <Table
        columns={columns}
        data={data.users}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortDir}
        onSort={handleSort}
        emptyMessage="No users found"
        onRowClick={(row) => navigate(`/users/${row.user_id}`)}
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
