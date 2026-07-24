import React, { useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import { azureAdService } from '../../services/azureAdService';
import { useToast } from '../../hooks/useToast';
import OrgHierarchyView from '../../components/azure-ad/OrgHierarchyView';

function StatPill({ label, value, tone = 'default' }) {
  const tones = {
    default: 'bg-gray-50 text-gray-800 border-gray-100',
    success: 'bg-emerald-50 text-emerald-800 border-emerald-100',
    warn: 'bg-amber-50 text-amber-800 border-amber-100',
    danger: 'bg-rose-50 text-rose-800 border-rose-100',
    info: 'bg-sky-50 text-sky-800 border-sky-100',
  };
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${tones[tone] || tones.default}`}>
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-base font-semibold tabular-nums leading-tight">{value}</p>
    </div>
  );
}

export default function ActiveDirectoryPage() {
  const { addToast: showToast } = useToast();

  const [importOpen, setImportOpen] = useState(false);
  const [importPassword, setImportPassword] = useState('new@12345');
  const [showImportPassword, setShowImportPassword] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const closeImport = () => {
    if (importBusy) return;
    setImportOpen(false);
    setImportPassword('new@12345');
    setShowImportPassword(false);
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
        subtitle="Microsoft Entra ID"
        actions={(
          <div className="flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 bg-gray-900 text-white"
              title="Org hierarchy"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
              <span className="hidden sm:inline">Org</span>
            </span>
            <button
              type="button"
              onClick={() => { setImportResult(null); setImportOpen(true); }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-primary-200 bg-primary-50 text-primary-800 hover:bg-primary-100 transition-colors"
              title="Sync users from Entra"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
              </svg>
              Sync
            </button>
          </div>
        )}
      />

      <OrgHierarchyView />

      <Modal
        isOpen={importOpen}
        onClose={closeImport}
        title="Sync from Entra"
        size="lg"
        footer={(
          <>
            <button
              type="button"
              onClick={closeImport}
              disabled={importBusy}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => runImport({ dryRun: true })}
              disabled={importBusy}
              className="px-3 py-1.5 text-xs font-medium text-gray-800 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              {importBusy ? 'Working…' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => runImport({ dryRun: false })}
              disabled={importBusy}
              className="px-3 py-1.5 text-xs font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {importBusy ? 'Syncing…' : 'Sync now'}
            </button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Match by Azure ID or email. Updates profile, job title, company/office links, and org membership.
            New users get the password below — no emails are sent.
          </p>

          <div>
            <label htmlFor="entra-sync-password" className="block text-sm font-medium text-gray-700 mb-1">
              Password for new users
            </label>
            <div className="relative">
              <input
                id="entra-sync-password"
                type={showImportPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={importPassword}
                onChange={(e) => setImportPassword(e.target.value)}
                placeholder="new@12345"
                className="w-full pl-3 pr-10 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                type="button"
                onClick={() => setShowImportPassword((v) => !v)}
                className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-700"
                title={showImportPassword ? 'Hide password' : 'Show password'}
                aria-label={showImportPassword ? 'Hide password' : 'Show password'}
              >
                {showImportPassword ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Default <span className="font-mono">new@12345</span> · existing users keep their password
            </p>
          </div>

          {importResult && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold text-gray-900">
                  {importResult.dry_run ? 'Preview' : 'Result'}
                </h4>
                {importResult.dry_run && <Badge variant="default" size="sm">Dry run</Badge>}
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <StatPill label="In Entra" value={importResult.total_graph || 0} />
                <StatPill label="Create" value={importResult.created || 0} tone="success" />
                <StatPill label="Update" value={importResult.updated || 0} tone="info" />
                <StatPill label="Errors" value={importResult.skipped || (importResult.errors?.length || 0)} tone="danger" />
                <StatPill label="Job titles" value={importResult.job_titles_ensured || 0} />
                <StatPill label="Depts" value={importResult.departments_linked || 0} />
                <StatPill label="Created depts" value={importResult.departments_created || 0} tone="success" />
                <StatPill label="Managers" value={importResult.reporting_linked || 0} />
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
