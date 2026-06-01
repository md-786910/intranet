import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import AzureOrgChart from '../../components/azure-ad/AzureOrgChart';

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
  const { addToast: showToast } = useToast();
  const { page, limit, setPage, setLimit, resetPage } = usePagination({ initialPage: 1, initialLimit: 50 });

  // View mode
  const [view, setView] = useState('list');

  // List state
  const [users, setUsers]       = useState([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(false);

  // Filters
  const [search, setSearch]         = useState('');
  const [department, setDepartment] = useState('');
  const [statusFilter, setStatus]   = useState('');
  const debouncedSearch             = useDebounce(search, 300);

  // Tree state
  const [roots, setRoots]         = useState([]);
  const [treeLoading, setTreeLoading] = useState(false);

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
      if (statusFilter !== '') params.accountEnabled = statusFilter;
      const res = await azureAdService.getUsers(params);
      const payload = res.data?.data || {};
      setUsers(payload.items || []);
      setTotal(payload.total || 0);
    } catch {
      showToast('Failed to load Active Directory users', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, department, statusFilter, showToast]);

  useEffect(() => {
    if (view === 'list') fetchUsers();
  }, [fetchUsers, view]);

  // Reset page on filter change
  useEffect(() => { resetPage(); }, [debouncedSearch, department, statusFilter, resetPage]);

  // ── Fetch org tree roots ──
  useEffect(() => {
    if (view !== 'tree') return;
    if (roots.length > 0) return; // already loaded
    setTreeLoading(true);
    azureAdService.getOrgTreeRoots()
      .then((res) => setRoots(res.data?.data || []))
      .catch(() => showToast('Failed to load org hierarchy', 'error'))
      .finally(() => setTreeLoading(false));
  }, [view, roots.length, showToast]);

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

            {/* Status */}
            <select
              value={statusFilter}
              onChange={(e) => setStatus(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 min-w-[130px]"
            >
              <option value="">All Statuses</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
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
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Reporting Hierarchy</p>
            <p className="text-xs text-gray-400">Click a card to view profile · +/− to expand direct reports</p>
          </div>

          {treeLoading ? (
            <div className="p-8 flex justify-center">
              <svg className="animate-spin w-6 h-6 text-primary-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            </div>
          ) : roots.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">No users found</div>
          ) : (
            <div className="py-6 px-6 overflow-x-auto flex gap-8 justify-center flex-wrap">
              {roots.map((user) => (
                <AzureOrgChart key={user.id} user={user} depth={0} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
