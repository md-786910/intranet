import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Table from '../../components/common/Table';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';

// ── Small helpers ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-indigo-600','bg-violet-600','bg-sky-600','bg-teal-600',
  'bg-emerald-600','bg-amber-600','bg-rose-600','bg-fuchsia-600',
];
function hashColor(str = '') {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function getInitials(name = '') {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function Avatar({ name, size = 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-xl' : 'w-9 h-9 text-sm';
  return (
    <div className={`${dim} rounded-full ${hashColor(name)} flex items-center justify-center text-white font-bold shrink-0`}>
      {getInitials(name)}
    </div>
  );
}

function EnabledBadge({ enabled }) {
  return enabled
    ? <Badge variant="success">Enabled</Badge>
    : <Badge variant="default">Disabled</Badge>;
}

/** Single labelled field row */
function Field({ label, value, mono = false }) {
  const display = value === null || value === undefined || value === '' ? (
    <span className="text-gray-300">—</span>
  ) : React.isValidElement(value) ? (
    value
  ) : (
    <span className={`${mono ? 'font-mono text-xs' : ''} break-all`}>{String(value)}</span>
  );
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-800">{display}</dd>
    </div>
  );
}

/** Section card with a title */
function Section({ title, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
      </div>
      <dl className="px-5 py-1">{children}</dl>
    </div>
  );
}

/** Formats ISO date strings nicely */
function fmtDate(iso) {
  if (!iso) return null;
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

/** Format array values */
function fmtArray(arr) {
  if (!arr || arr.length === 0) return null;
  return arr.join(', ');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',    label: 'Overview' },
  { key: 'properties',  label: 'Properties' },
  { key: 'reports',     label: 'Direct Reports' },
  { key: 'orgpath',     label: 'Org Path' },
];

// ── Direct Reports mini-table ─────────────────────────────────────────────────
const REPORT_COLS = [
  {
    key: 'displayName', label: 'Name',
    render: (row) => (
      <div className="flex items-center gap-2.5">
        <div className={`w-7 h-7 rounded-full ${hashColor(row.displayName||'')} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
          {getInitials(row.displayName || '')}
        </div>
        <span className="font-medium text-gray-900">{row.displayName}</span>
      </div>
    ),
  },
  { key: 'jobTitle',   label: 'Job Title',  render: (r) => r.jobTitle   || <span className="text-gray-300">—</span> },
  { key: 'department', label: 'Department', render: (r) => r.department || <span className="text-gray-300">—</span> },
  { key: 'mail',       label: 'Email',      render: (r) => r.mail || r.userPrincipalName || <span className="text-gray-300">—</span> },
  { key: 'accountEnabled', label: 'Status', render: (r) => <EnabledBadge enabled={r.accountEnabled} /> },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function ActiveDirectoryUserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast: showToast } = useToast();

  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState('overview');

  // Direct reports (loaded lazily when tab selected)
  const [reports, setReports]         = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Org path (manager chain — built from user._manager, then recursively)
  const [orgPath, setOrgPath]       = useState([]);
  const [orgPathLoading, setOrgPathLoading] = useState(false);

  // ── Load user ──
  useEffect(() => {
    setLoading(true);
    setUser(null);
    setReports(null);
    setOrgPath([]);
    azureAdService.getUser(id)
      .then((res) => setUser(res.data?.data || null))
      .catch(() => showToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [id, showToast]);

  // ── Load direct reports when tab selected ──
  useEffect(() => {
    if (tab !== 'reports' || reports !== null) return;
    setReportsLoading(true);
    azureAdService.getDirectReports(id)
      .then((res) => setReports(res.data?.data || []))
      .catch(() => showToast('Failed to load direct reports', 'error'))
      .finally(() => setReportsLoading(false));
  }, [tab, id, reports, showToast]);

  // ── Build org path when tab selected ──
  useEffect(() => {
    if (tab !== 'orgpath' || !user) return;
    if (orgPath.length > 0) return; // already built

    // Walk manager chain: user._manager is already loaded with the user
    const chain = [];
    setOrgPathLoading(true);

    async function walkUp(managerId) {
      if (!managerId) { setOrgPath(chain); setOrgPathLoading(false); return; }
      try {
        const res = await azureAdService.getUser(managerId);
        const mgr = res.data?.data;
        if (mgr) {
          chain.unshift(mgr); // prepend — root first
          await walkUp(mgr._manager?.id);
        } else {
          setOrgPath(chain);
          setOrgPathLoading(false);
        }
      } catch {
        setOrgPath(chain);
        setOrgPathLoading(false);
      }
    }

    walkUp(user._manager?.id);
  }, [tab, user, orgPath.length]);

  // ── Loading skeleton ──
  if (loading) {
    return (
      <div>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-48" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-6 text-center text-gray-500">
        User not found.{' '}
        <button className="text-primary-600 underline" onClick={() => navigate('/active-directory')}>
          Back to list
        </button>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="space-y-6">
      <PageHeader
        title={user.displayName}
        subtitle={user.jobTitle || user.userPrincipalName}
        backTo="/active-directory"
      />

      {/* ── User hero card ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-5">
        <Avatar name={user.displayName || ''} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{user.displayName}</h2>
          <p className="text-sm text-gray-500">{user.jobTitle}{user.jobTitle && user.department ? ' · ' : ''}{user.department}</p>
          <p className="text-xs text-gray-400 mt-0.5">{user.mail || user.userPrincipalName}</p>
          {user._manager && (
            <p className="text-xs text-gray-500 mt-1.5">
              Reports to{' '}
              <Link
                to={`/active-directory/${user._manager.id}`}
                className="text-primary-600 font-medium hover:underline"
              >
                {user._manager.displayName}
              </Link>
              {user._manager.jobTitle && <span className="text-gray-400"> · {user._manager.jobTitle}</span>}
            </p>
          )}
        </div>
        <div className="shrink-0">
          <EnabledBadge enabled={user.accountEnabled} />
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-200 px-5 pt-1 gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                tab === t.key
                  ? 'border-primary-600 text-primary-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
              {t.key === 'reports' && reports !== null && (
                <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
                  {reports.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Tab: Overview ── */}
        {tab === 'overview' && (
          <div className="p-5 grid sm:grid-cols-2 gap-x-8 gap-y-1">
            <dl>
              <Field label="Display Name"    value={user.displayName} />
              <Field label="User Principal Name" value={user.userPrincipalName} mono />
              <Field label="Object ID"       value={user.id} mono />
              <Field label="User Type"       value={user.userType} />
              <Field label="Account Status"  value={<EnabledBadge enabled={user.accountEnabled} />} />
              <Field label="Company"         value={user.companyName} />
            </dl>
            <dl>
              <Field label="Usage Location"  value={user.usageLocation} />
              <Field label="Created"         value={fmtDate(user.createdDateTime)} />
              <Field label="Password Policies" value={user.passwordPolicies} />
              <Field label="Mail Nickname"   value={user.mailNickname} />
              <Field label="Preferred Language" value={user.preferredLanguage} />
              {user._manager && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
                  <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">Manager</dt>
                  <dd>
                    <Link
                      to={`/active-directory/${user._manager.id}`}
                      className="text-sm text-primary-600 hover:underline font-medium"
                    >
                      {user._manager.displayName}
                    </Link>
                    {user._manager.jobTitle && <span className="text-xs text-gray-400 ml-1">· {user._manager.jobTitle}</span>}
                  </dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* ── Tab: Properties ── */}
        {tab === 'properties' && (
          <div className="p-5 space-y-5">
            {/* Identity */}
            <Section title="Identity">
              <Field label="Display Name"    value={user.displayName} />
              <Field label="First Name"      value={user.givenName} />
              <Field label="Last Name"       value={user.surname} />
              <Field label="User Principal Name" value={user.userPrincipalName} mono />
              <Field label="Object ID"       value={user.id} mono />
              <Field label="User Type"       value={user.userType} />
              {user.identities && user.identities.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">Identities</dt>
                  <dd className="space-y-1 text-sm text-gray-800">
                    {user.identities.map((identity, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="info">{identity.signInType}</Badge>
                        <span className="font-mono text-xs text-gray-600">{identity.issuerAssignedId}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              )}
            </Section>

            {/* Job Information */}
            <Section title="Job Information">
              <Field label="Job Title"       value={user.jobTitle} />
              <Field label="Company Name"    value={user.companyName} />
              <Field label="Department"      value={user.department} />
              <Field label="Employee ID"     value={user.employeeId} />
              <Field label="Employee Type"   value={user.employeeType} />
              <Field label="Employee Hire Date" value={user.employeeHireDate ? fmtDate(user.employeeHireDate) : null} />
              <Field label="Office Location" value={user.officeLocation} />
              {user._manager ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">Manager</dt>
                  <dd>
                    <Link
                      to={`/active-directory/${user._manager.id}`}
                      className="text-sm text-primary-600 hover:underline font-medium"
                    >
                      {user._manager.displayName}
                    </Link>
                    {user._manager.jobTitle && (
                      <span className="text-xs text-gray-400 ml-1">· {user._manager.jobTitle}</span>
                    )}
                    <p className="text-xs text-gray-400 font-mono">{user._manager.userPrincipalName}</p>
                  </dd>
                </div>
              ) : (
                <Field label="Manager" value={null} />
              )}
            </Section>

            {/* Contact Information */}
            <Section title="Contact Information">
              <Field label="Email"           value={user.mail} />
              <Field label="Business Phone"  value={fmtArray(user.businessPhones)} />
              <Field label="Mobile Phone"    value={user.mobilePhone} />
              <Field label="Street Address"  value={user.streetAddress} />
              <Field label="City"            value={user.city} />
              <Field label="State / Province" value={user.state} />
              <Field label="ZIP / Postal Code" value={user.postalCode} />
              <Field label="Country / Region" value={user.country} />
              {user.proxyAddresses && user.proxyAddresses.length > 0 && (
                <Field label="Proxy Addresses" value={fmtArray(user.proxyAddresses)} />
              )}
              {user.imAddresses && user.imAddresses.length > 0 && (
                <Field label="IM Addresses"  value={fmtArray(user.imAddresses)} />
              )}
            </Section>

            {/* Settings */}
            <Section title="Settings">
              <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
                <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">Account Enabled</dt>
                <dd><EnabledBadge enabled={user.accountEnabled} /></dd>
              </div>
              <Field label="Usage Location"    value={user.usageLocation} />
              <Field label="Password Policies" value={user.passwordPolicies} />
              <Field label="Mail Nickname"     value={user.mailNickname} />
              <Field label="Preferred Language" value={user.preferredLanguage} />
            </Section>

            {/* On-premises */}
            <Section title="On-premises">
              <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100">
                <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">On-premises Sync</dt>
                <dd>
                  {user.onPremisesSyncEnabled
                    ? <Badge variant="success">Enabled</Badge>
                    : <Badge variant="default">Not synced</Badge>}
                </dd>
              </div>
              <Field label="Last Sync"            value={fmtDate(user.onPremisesLastSyncDateTime)} />
              <Field label="Distinguished Name"   value={user.onPremisesDistinguishedName} mono />
              <Field label="Immutable ID"         value={user.onPremisesImmutableId} mono />
              <Field label="SAM Account Name"     value={user.onPremisesSamAccountName} mono />
              {user.onPremisesProvisioningErrors && user.onPremisesProvisioningErrors.length > 0 ? (
                <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-4 py-2.5 border-b border-gray-100 last:border-0">
                  <dt className="w-full sm:w-52 shrink-0 text-xs font-medium text-gray-500 uppercase tracking-wide pt-0.5">Provisioning Errors</dt>
                  <dd className="space-y-1">
                    {user.onPremisesProvisioningErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Badge variant="danger">{err.category}</Badge>
                        <span className="text-xs text-gray-600">{err.propertyCausingError}: {err.value}</span>
                      </div>
                    ))}
                  </dd>
                </div>
              ) : (
                <Field label="Provisioning Errors" value="None" />
              )}
            </Section>
          </div>
        )}

        {/* ── Tab: Direct Reports ── */}
        {tab === 'reports' && (
          <div className="p-5">
            {reportsLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-4">
                  {reports?.length || 0} direct report{reports?.length !== 1 ? 's' : ''}
                </p>
                <Table
                  columns={REPORT_COLS}
                  data={reports || []}
                  emptyMessage="No direct reports"
                  onRowClick={(row) => navigate(`/active-directory/${row.id}`)}
                />
              </>
            )}
          </div>
        )}

        {/* ── Tab: Org Path ── */}
        {tab === 'orgpath' && (
          <div className="p-5">
            {orgPathLoading ? (
              <div className="animate-pulse space-y-3">
                {[...Array(3)].map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {orgPath.length === 0 && !user._manager && (
                  <p className="text-sm text-gray-400">No manager chain — this user is at the top of the hierarchy.</p>
                )}
                {/* Manager chain (root first) */}
                {orgPath.map((mgr, idx) => (
                  <div key={mgr.id} className="flex items-center gap-3" style={{ paddingLeft: `${idx * 24}px` }}>
                    {idx > 0 && (
                      <svg className="w-4 h-4 text-gray-300 shrink-0 -ml-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18M5 21l7-7 7 7" />
                      </svg>
                    )}
                    <Link
                      to={`/active-directory/${mgr.id}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors group min-w-0"
                    >
                      <div className={`w-8 h-8 rounded-full ${hashColor(mgr.displayName||'')} flex items-center justify-center text-white text-xs font-bold shrink-0`}>
                        {getInitials(mgr.displayName||'')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 group-hover:text-primary-700">{mgr.displayName}</p>
                        <p className="text-xs text-gray-400">{mgr.jobTitle}</p>
                      </div>
                    </Link>
                  </div>
                ))}

                {/* Current user (highlighted) */}
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-50 border border-primary-200"
                  style={{ paddingLeft: `${orgPath.length * 24 + 12}px` }}
                >
                  <Avatar name={user.displayName || ''} size="sm" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary-800">{user.displayName} <span className="text-xs font-normal text-primary-500">(You are here)</span></p>
                    <p className="text-xs text-primary-600">{user.jobTitle}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
