import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';
import OrgHierarchyView from '../../components/azure-ad/OrgHierarchyView';

const VALID_VIEWS = new Set(['list', 'tree']);

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

function StatPill({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-gray-50 text-gray-800',
    success: 'bg-emerald-50 text-emerald-800',
    warn: 'bg-amber-50 text-amber-800',
    danger: 'bg-rose-50 text-rose-800',
  };
  return (
    <div className={`rounded-lg px-3 py-2 ${tones[tone] || tones.default}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ActiveDirectoryPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToast: showToast } = useToast();
  const { page, limit, setPage, setLimit, resetPage } = usePagination({ initialPage: 1, initialLimit: 50 });

  // View mode — persisted in ?view=list|tree
  const view = useMemo(() => {
    const v = searchParams.get('view');
    return VALID_VIEWS.has(v) ? v : 'list';
  }, [searchParams]);

  const setView = useCallback((next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next === 'list') params.delete('view');
      else params.set('view', next);
      return params;
    }, { replace: true });
  }, [setSearchParams]);

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

  // Import modal
  const [importOpen, setImportOpen] = useState(false);
  const [importPassword, setImportPassword] = useState('new@12345');
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  const closeImport = () => {
    if (importBusy) return;
    setImportOpen(false);
    setImportPassword('new@12345');
    setImportResult(null);
  };

  const runImport = async ({ dryRun }) => {
    const pwd = importPassword.trim() || 'new@12345';
    if (pwd.length < 6) {
      showToast('Temporary password must be at least 6 characters', 'error');
      return;
    }
    setImportBusy(true);
    try {
      const res = await azureAdService.syncUsers({
        dry_run: dryRun,
        only_enabled: true,
        password: pwd,
      });
      const data = res.data?.data || {};
      setImportResult(data);
      if (!dryRun) {
        showToast(
          `Sync complete: ${data.updated || 0} updated, ${data.created || 0} created`,
          'success'
        );
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Sync failed';
      showToast(msg, 'error');
    } finally {
      setImportBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Active Directory"
        subtitle="Microsoft Entra ID — all users"
        actions={(
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => { setImportResult(null); setImportOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 shadow-sm"
            >
              Sync from Azure
            </button>
            <ViewToggle view={view} onChange={setView} />
          </div>
        )}
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
      {view === 'tree' && <OrgHierarchyView />}

      <Modal
        isOpen={importOpen}
        onClose={closeImport}
        title="Sync users from Azure"
        size="xl"
        footer={(
          <>
            <button
              type="button"
              onClick={closeImport}
              disabled={importBusy}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => runImport({ dryRun: true })}
              disabled={importBusy}
              className="px-4 py-2 text-sm font-medium text-gray-800 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
            >
              {importBusy ? 'Working…' : 'Dry run'}
            </button>
            <button
              type="button"
              onClick={() => runImport({ dryRun: false })}
              disabled={importBusy}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {importBusy ? 'Syncing…' : 'Sync now'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Matches by Azure id or email. Pulls department and job title from Entra onto the user
            (job titles are added to the Job Title catalog). Everyone is assigned the Employee role
            at organisation level — org-tree / team placement is skipped so admins can attach people later.
            No emails are sent.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password for new users
            </label>
            <input
              type="password"
              autoComplete="new-password"
              value={importPassword}
              onChange={(e) => setImportPassword(e.target.value)}
              placeholder="new@12345"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Default is <span className="font-mono">new@12345</span>. Applied only to newly created
              users. Existing users keep their current password; no emails are sent.
            </p>
          </div>

          {importResult && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {importResult.dry_run ? 'Dry-run preview' : 'Sync result'}
                </h4>
                {importResult.dry_run && <Badge variant="default">Preview only</Badge>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <StatPill label="In Entra" value={importResult.total_graph || 0} />
                <StatPill label="Create" value={importResult.created || 0} tone="success" />
                <StatPill label="Update" value={importResult.updated || 0} />
                <StatPill label="Job titles" value={importResult.job_titles_ensured || 0} />
                <StatPill label="Reporting links" value={importResult.reporting_linked || 0} />
                <StatPill label="Skipped / errors" value={importResult.skipped || (importResult.errors?.length || 0)} tone="danger" />
              </div>

              {Array.isArray(importResult.samples) && importResult.samples.length > 0 && (
                <div className="max-h-48 overflow-auto border border-gray-100 rounded-lg">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50 sticky top-0">
                      <tr className="text-left text-gray-500">
                        <th className="px-3 py-2 font-medium">User</th>
                        <th className="px-3 py-2 font-medium">Action</th>
                        <th className="px-3 py-2 font-medium">Department</th>
                        <th className="px-3 py-2 font-medium">Job title</th>
                        <th className="px-3 py-2 font-medium">App role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.samples.map((row) => (
                        <tr key={row.azure_id} className="border-t border-gray-50">
                          <td className="px-3 py-2">
                            <div className="font-medium text-gray-900">{row.displayName}</div>
                            <div className="text-gray-400">{row.email || '—'}</div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 capitalize">{row.action || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.department || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.jobTitle || '—'}</td>
                          <td className="px-3 py-2 text-gray-600">{row.role || 'EMPLOYEE'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {Array.isArray(importResult.errors) && importResult.errors.length > 0 && (
                <div className="max-h-32 overflow-auto rounded-lg bg-rose-50 text-rose-800 text-xs p-3 space-y-1">
                  {importResult.errors.slice(0, 20).map((err, idx) => (
                    <div key={`${err.azure_id || idx}-${idx}`}>
                      {err.email || err.azure_id}: {err.reason}
                    </div>
                  ))}
                  {importResult.errors.length > 20 && (
                    <div>…and {importResult.errors.length - 20} more</div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
