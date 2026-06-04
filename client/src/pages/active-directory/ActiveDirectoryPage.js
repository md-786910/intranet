import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import OrgHierarchyView from '../../components/azure-ad/OrgHierarchyView';

// ── Avatar helper ─────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  'bg-indigo-600','bg-violet-600','bg-sky-600','bg-teal-600',
  'bg-emerald-600','bg-amber-600','bg-rose-600','bg-fuchsia-600',
];

function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function hashColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function Avatar({ name }) {
  return (
    <div className={`w-8 h-8 rounded-full ${hashColor(name)} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function EnabledBadge({ enabled }) {
  return enabled
    ? <Badge variant="success">Enabled</Badge>
    : <Badge variant="default">Disabled</Badge>;
}

// ── Table columns ─────────────────────────────────────────────────────────────
const COLUMNS = [
  {
    key: 'displayName',
    label: 'Name',
    render: (row) => (
      <div className="flex items-center gap-3">
        <Avatar name={row.displayName || ''} />
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{row.displayName}</p>
          <p className="text-xs text-gray-400 truncate">{row.mail || row.userPrincipalName}</p>
        </div>
      </div>
    ),
  },
  { key: 'jobTitle',   label: 'Job Title',   render: (row) => row.jobTitle   || <span className="text-gray-300">—</span> },
  { key: 'department', label: 'Department',  render: (row) => row.department || <span className="text-gray-300">—</span> },
  { key: '_managerName', label: 'Reporting Manager', render: (row) => row._managerName || <span className="text-gray-300">—</span> },
  { key: 'officeLocation', label: 'Office',  render: (row) => row.officeLocation || <span className="text-gray-300">—</span> },
  { key: 'accountEnabled', label: 'Status',  render: (row) => <EnabledBadge enabled={row.accountEnabled} /> },
];

// ── View toggle button ────────────────────────────────────────────────────────
function ViewToggle({ view, onChange }) {
  const btn = (id, label, icon) => (
    <button
      key={id}
      onClick={() => onChange(id)}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
        view === id
          ? 'bg-primary-600 text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
      {btn('list', 'List',
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12M8.25 17.25h12M3.75 6.75h.007v.008H3.75V6.75zm0 5.25h.007v.008H3.75V12zm0 5.25h.007v.008H3.75v-.008z" />
        </svg>
      )}
      {btn('tree', 'Org Hierarchy',
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
        </svg>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ActiveDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast: showToast } = useToast();
  const { page, limit, setPage, setLimit, resetPage } = usePagination({ initialPage: 1, initialLimit: 50 });

  // View mode — persisted in URL (?view=list|tree)
  const view = searchParams.get('view') === 'tree' ? 'tree' : 'list';
  const setView = (v) => setSearchParams((prev) => { const next = new URLSearchParams(prev); next.set('view', v); return next; }, { replace: true });

  // List state
  const [users, setUsers]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [department, setDepartment] = useState('');
  const debouncedSearch             = useDebounce(search, 300);

  // Departments for filter
  const [departments, setDepartments] = useState([]);

  // ── Load departments once ──
  useEffect(() => {
    azureAdService.getDepartments()
      .then((res) => setDepartments(res.data?.data || []))
      .catch(() => {});
  }, []);

  // ── Fetch list ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit, search: debouncedSearch, department };
      const res = await azureAdService.getUsers(params);
      const payload = res.data?.data || {};
      setUsers(payload.items || []);
      setTotal(payload.total || 0);
    } catch {
      showToast('Failed to load Active Directory users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, department, showToast]);

  useEffect(() => {
    if (view === 'list') fetchUsers();
  }, [fetchUsers, view]);

  // Reset page on filter change
  useEffect(() => { resetPage(); }, [debouncedSearch, department, resetPage]);

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Directory"
        subtitle="Microsoft Entra ID — all users"
        actions={<ViewToggle view={view} onChange={setView} />}
      />

      {/* ── LIST VIEW ── */}
      {view === 'list' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search name, email, job title…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white"
              />
            </div>

            {/* Department */}
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[160px]"
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>

            {/* Count badge */}
            {!loading && (
              <span className="text-sm text-gray-400 ml-auto">
                {total.toLocaleString()} user{total !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          <Table
            columns={COLUMNS}
            data={users}
            loading={loading}
            emptyMessage="No users found matching your filters"
            onRowClick={(row) => navigate(`/active-directory/${row.id}`)}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            limit={limit}
            onPageChange={setPage}
            onLimitChange={(v) => { setLimit(v); resetPage(); }}
          />
        </div>
      )}

      {/* ── TREE VIEW ── */}
      {view === 'tree' && (
        <div className="w-full min-w-0">
          <OrgHierarchyView />
        </div>
      )}
    </div>
  );
}
