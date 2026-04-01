import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Table from '../../components/common/Table';
import Pagination from '../../components/common/Pagination';
import SearchBar from '../../components/common/SearchBar';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { usePagination } from '../../hooks/usePagination';
import { useDebounce } from '../../hooks/useDebounce';

const DEFAULT_ORGANISATION_ID = 1;

function groupPermissionsByModule(permissions) {
  if (!permissions?.length) return [];
  const map = {};
  for (const p of permissions) {
    const mod = p.moduleAction?.module;
    const action = p.moduleAction;
    if (!mod || !action) continue;
    if (!map[mod.code]) {
      map[mod.code] = { moduleName: mod.name, moduleCode: mod.code, actions: [] };
    }
    map[mod.code].actions.push({ name: action.name, actionCode: action.action_code });
  }
  return Object.values(map).sort((a, b) => a.moduleName.localeCompare(b.moduleName));
}

function PermissionSummary({ permissions }) {
  const [expanded, setExpanded] = React.useState(false);
  const groups = groupPermissionsByModule(permissions);
  const total = permissions?.length || 0;

  if (total === 0) {
    return <span className="text-sm text-gray-400">No permissions</span>;
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        className="text-sm text-gray-600 hover:text-gray-900 text-left flex items-center gap-1"
        onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
      >
        <span>{total} permissions across {groups.length} module{groups.length !== 1 ? 's' : ''}</span>
        <svg className={`w-3.5 h-3.5 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!expanded && (
        <div className="flex flex-wrap gap-1">
          {groups.map((g) => (
            <span key={g.moduleCode} className="inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded">
              {g.moduleName} ({g.actions.length})
            </span>
          ))}
        </div>
      )}
      {expanded && (
        <div className="mt-1 space-y-1.5">
          {groups.map((g) => (
            <div key={g.moduleCode}>
              <div className="text-xs font-medium text-gray-700">{g.moduleName}</div>
              <div className="flex flex-wrap gap-1 mt-0.5">
                {g.actions.map((a) => (
                  <span key={a.actionCode} className="inline-flex items-center px-1.5 py-0.5 text-xs bg-blue-50 text-blue-700 rounded">
                    {a.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const ROLE_DESCRIPTIONS = {
  OWNER: 'Full platform access. Can manage all settings, users, and content across the entire organisation.',
  OFFICE_MANAGER: 'Manage verticals, departments, users, and all content within an office location.',
  CONTENT_EDITOR: 'Create, edit, and publish news articles and documents.',
  EMPLOYEE: 'View news, documents, and directory. Basic read-only access.',
};

export default function RolesListPage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { page, limit, setPage } = usePagination();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search);
  const [allRoles, setAllRoles] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchRoles = useCallback(async () => {
    try {
      setLoading(true);
      const res = await roleService.getRoles({
        page, limit: 100, search: debouncedSearch, scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID,
      });
      const data = res.data?.data || { roles: [], pagination: {} };
      setAllRoles(data.roles || []);
      setPagination(data.pagination || {});
    } catch (err) {
      addToast('Failed to load roles', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, limit, debouncedSearch, addToast]);

  useEffect(() => { fetchRoles(); }, [fetchRoles]);

  const systemRoles = allRoles.filter(r => r.is_system);
  const customRoles = allRoles.filter(r => !r.is_system);

  const handleClone = (role) => {
    navigate('/roles/create', { state: { cloneFrom: role } });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await roleService.deleteRole(deleteTarget.role_id);
      addToast('Role deleted successfully', 'success');
      setDeleteTarget(null);
      fetchRoles();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete role', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const customColumns = [
    { key: 'name', label: 'Role Name', render: (row) => (
      <div>
        <div className="font-medium text-gray-900">{row.name}</div>
        {row.description && <div className="text-xs text-gray-500 mt-0.5">{row.description}</div>}
      </div>
    )},
    { key: 'code', label: 'Code', render: (row) => (
      <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{row.code}</code>
    )},
    { key: 'permissions', label: 'Permissions', render: (row) => (
      <PermissionSummary permissions={row.permissions} />
    )},
    { key: 'actions', label: '', render: (row) => (
      <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
        <button onClick={() => navigate(`/roles/${row.role_id}`)}
          className="px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 rounded">Edit</button>
        <button onClick={() => handleClone(row)}
          className="px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">Clone</button>
        <button onClick={() => setDeleteTarget(row)}
          className="px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 rounded">Delete</button>
      </div>
    )},
  ];

  return (
    <div>
      <PageHeader
        title="Roles & Permissions"
        subtitle="Define what users can do across the platform."
        actions={<Button onClick={() => navigate('/roles/create')}>Create New Role</Button>}
      />

      {/* ── System Roles ── */}
      <section className="mb-8">
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">System Roles</h2>
          <p className="text-xs text-gray-500 mt-0.5">Built-in roles that cannot be modified or deleted.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            [...Array(4)].map((_, i) => <div key={i} className="animate-pulse bg-gray-100 rounded-xl h-40" />)
          ) : (
            systemRoles.map((role) => (
              <div key={role.role_id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{role.name}</h3>
                    <code className="text-xs text-gray-400">{role.code}</code>
                  </div>
                  <Badge variant="info" size="sm">System</Badge>
                </div>
                <p className="text-xs text-gray-500 flex-1 mb-3">
                  {ROLE_DESCRIPTIONS[role.code] || role.description || 'System-defined role'}
                </p>
                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <span className="text-xs text-gray-400" title={groupPermissionsByModule(role.permissions).map(g => `${g.moduleName}: ${g.actions.map(a => a.name).join(', ')}`).join('\n')}>
                    {role.permissions?.length || 0} permissions ({groupPermissionsByModule(role.permissions).map(g => g.moduleName).join(', ')})
                  </span>
                  <div className="flex gap-2">
                    <button onClick={() => navigate(`/roles/${role.role_id}`)}
                      className="text-xs font-medium text-primary-600 hover:text-primary-800">View</button>
                    <button onClick={() => handleClone(role)}
                      className="text-xs font-medium text-gray-500 hover:text-gray-700">Clone</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* ── Custom Roles ── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Custom Roles</h2>
            <p className="text-xs text-gray-500 mt-0.5">Roles created by your team. Fully editable.</p>
          </div>
          {customRoles.length > 0 && (
            <div className="w-64">
              <SearchBar value={search} onChange={setSearch} placeholder="Search custom roles..." />
            </div>
          )}
        </div>

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded" />)}
          </div>
        ) : customRoles.length === 0 && !search ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-gray-500 mb-3">No custom roles yet.</p>
            <Button size="sm" onClick={() => navigate('/roles/create')}>Create your first role</Button>
          </div>
        ) : (
          <>
            <Table
              columns={customColumns}
              data={customRoles}
              emptyMessage="No matching roles"
              onRowClick={(row) => navigate(`/roles/${row.role_id}`)}
            />
            {pagination.totalPages > 1 && (
              <Pagination page={pagination.page} totalPages={pagination.totalPages}
                total={pagination.total} limit={pagination.limit} onPageChange={setPage} />
            )}
          </>
        )}
      </section>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Role"
        message={`Permanently delete "${deleteTarget?.name}"? Users assigned to this role will lose these permissions.`}
      />
    </div>
  );
}
