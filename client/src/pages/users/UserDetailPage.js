import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import ScopePicker from '../../components/common/ScopePicker';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatDateTime, formatRelativeTime } from '../../utils/formatters';
import { findScopeLabel } from '../../utils/scopeLabel';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';
import { useOrgTree } from '../../hooks/useOrgTree';

const DEFAULT_ORGANISATION_ID = 1;

// Em-dash placeholders read as "missing data" — replace with "Not set" in
// italic gray to signal a known-empty optional field that can be filled
// via Edit.
function Field({ label, value, hint }) {
  const empty = value === null || value === undefined || value === '';
  return (
    <div className="py-2.5">
      <dt className="text-xs uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className={`mt-1 text-sm ${empty ? 'text-gray-400 italic font-normal' : 'text-gray-900 font-medium'}`}>
        {empty ? (hint || 'Not set') : value}
      </dd>
    </div>
  );
}

function initialsOf(firstName, lastName, email) {
  const a = (firstName || '').charAt(0);
  const b = (lastName || '').charAt(0);
  if (a || b) return `${a}${b}`.toUpperCase();
  return (email || '?').slice(0, 2).toUpperCase();
}

function extractPermissionIds(role) {
  if (!role?.permissions) return new Set();
  return new Set(
    role.permissions
      .filter((p) => p.effect === 'ALLOW')
      .map((p) => p.moduleAction?.module_action_id)
      .filter(Boolean)
  );
}

// ── Role Assignment Card ──
function RoleCard({ assignment, allRoles, modules, onRemove, removing }) {
  const [showPerms, setShowPerms] = useState(false);
  const role = allRoles.find((r) => r.role_id === assignment.role_id || r.role_id === assignment.role?.role_id);
  const permissionIds = useMemo(() => extractPermissionIds(role), [role]);
  const permCount = permissionIds.size;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between p-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {assignment.role?.name || role?.name || 'Unknown Role'}
            </span>
            {(assignment.role?.is_system || role?.is_system) && (
              <Badge variant="info" size="sm">System</Badge>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {assignment.scope_type.replace(/_/g, ' ')} #{assignment.scope_id}
            {permCount > 0 && ` · ${permCount} permission${permCount !== 1 ? 's' : ''}`}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {modules.length > 0 && permCount > 0 && (
            <button onClick={() => setShowPerms(!showPerms)}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors">
              {showPerms ? 'Hide permissions' : 'View permissions'}
            </button>
          )}
          {!assignment.role?.is_system && !role?.is_system && (
            <Button variant="ghost" size="sm" onClick={() => onRemove(assignment.assignment_id)}
              loading={removing === assignment.assignment_id}
              className="text-red-500 hover:text-red-700 hover:bg-red-50">
              Remove
            </Button>
          )}
        </div>
      </div>
      {showPerms && modules.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
          <PermissionMatrix modules={modules} selectedPermissions={permissionIds} disabled />
        </div>
      )}
    </div>
  );
}

// ── Direct Permission Row ──
function DirectPermissionRow({ perm, onRemove, removing, scopeLabel }) {
  const moduleCode = perm.moduleAction?.module?.code || '';
  const actionCode = perm.moduleAction?.action_code || '';
  const moduleName = perm.moduleAction?.module?.name || moduleCode;
  const { label } = getPermLabel(moduleCode, actionCode);

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
      <div>
        <div className="text-sm font-medium text-gray-900">{label}</div>
        <div className="text-xs text-gray-500">
          {moduleName} · {scopeLabel || `${perm.scope_type.replace(/_/g, ' ')} #${perm.scope_id}`}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={() => onRemove(perm.user_permission_id)}
        loading={removing === perm.user_permission_id}
        className="text-red-500 hover:text-red-700 hover:bg-red-50">
        Remove
      </Button>
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const { tree: orgTree } = useOrgTree();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Roles & modules
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [removing, setRemoving] = useState(null);

  // Assign role form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopeType, setAssignScopeType] = useState('ORGANISATION');
  const [assignScopeId, setAssignScopeId] = useState(DEFAULT_ORGANISATION_ID);
  const [assigning, setAssigning] = useState(false);

  // Direct permission form
  const [showPermForm, setShowPermForm] = useState(false);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopes, setPermScopes] = useState([]);
  const [addingPerm, setAddingPerm] = useState(false);
  const [removingPerm, setRemovingPerm] = useState(null);

  const fetchUser = useCallback(() => {
    setLoading(true);
    userService.getUser(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => setUser(res.data?.data))
      .catch(() => addToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    roleService.getRoles({ limit: 100 }).then((res) => setAllRoles(res.data?.data?.roles || [])).catch(() => {});
    roleService.getModules().then((res) => setModules(res.data?.data || [])).catch(() => {});
  }, []);

  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await userService.deleteUser(id);
      addToast('User deactivated', 'success');
      navigate('/users');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to deactivate', 'error');
    } finally { setDeleting(false); setDeleteOpen(false); }
  };

  const handleAssignRole = async () => {
    if (!assignRoleId) return;
    setAssigning(true);
    try {
      await userService.assignRole(id, {
        role_id: Number(assignRoleId),
        scope_type: assignScopeType,
        scope_id: assignScopeId || DEFAULT_ORGANISATION_ID,
      });
      addToast('Role assigned successfully', 'success');
      setAssignRoleId('');
      setShowAssignForm(false);
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to assign role', 'error');
    } finally { setAssigning(false); }
  };

  const handleRemoveRole = async (assignmentId) => {
    setRemoving(assignmentId);
    try {
      await userService.removeRole(id, assignmentId);
      addToast('Role removed', 'success');
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove role', 'error');
    } finally { setRemoving(null); }
  };

  const handleAssignPermission = async () => {
    if (!permActionId) return;
    setAddingPerm(true);
    try {
      const scopesToAssign = permScopes.length > 0
        ? permScopes
        : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId || DEFAULT_ORGANISATION_ID }];

      const existingPermissions = new Set(
        (user?.directPermissions || []).map((perm) => `${perm.module_action_id}:${perm.scope_type}:${perm.scope_id}`),
      );

      const nextScopes = scopesToAssign.filter((scope) => (
        !existingPermissions.has(`${Number(permActionId)}:${scope.scope_type}:${scope.scope_id}`)
      ));

      if (nextScopes.length === 0) {
        addToast('Permission already assigned at the selected scope', 'error');
        return;
      }

      await Promise.all(
        nextScopes.map((scope) => userService.assignPermission(id, {
          module_action_id: Number(permActionId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id,
        })),
      );

      addToast(
        nextScopes.length === 1 ? 'Permission granted' : `${nextScopes.length} permissions granted`,
        'success',
      );
      setPermActionId('');
      setPermModuleId('');
      setPermScopes([]);
      setShowPermForm(false);
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to assign permission', 'error');
    } finally { setAddingPerm(false); }
  };

  const handleRemovePermission = async (permissionId) => {
    setRemovingPerm(permissionId);
    try {
      await userService.removePermission(id, permissionId);
      addToast('Permission removed', 'success');
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove permission', 'error');
    } finally { setRemovingPerm(null); }
  };

  // Derived
  const assignableRoleOptions = useMemo(() => {
    const assigned = new Set((user?.roleAssignments || []).map((a) => a.role_id || a.role?.role_id));
    return allRoles.filter((r) => !assigned.has(r.role_id))
      .map((r) => ({ value: String(r.role_id), label: `${r.name}${r.is_system ? ' (System)' : ''}` }));
  }, [allRoles, user?.roleAssignments]);

  const assignPickerRole = assignRoleId ? allRoles.find((r) => r.role_id === Number(assignRoleId)) : null;
  const assignPickerPerms = useMemo(() => extractPermissionIds(assignPickerRole), [assignPickerRole]);

  const moduleOptions = useMemo(() => modules.map((m) => ({ value: String(m.module_id), label: m.name })), [modules]);
  const actionOptions = useMemo(() => {
    if (!permModuleId) return [];
    const mod = modules.find((m) => m.module_id === Number(permModuleId));
    if (!mod) return [];
    return mod.actions
      .map((a) => { const { label } = getPermLabel(mod.code, a.action_code); return { value: String(a.module_action_id), label }; });
  }, [permModuleId, modules]);

  const directPermCount = user?.directPermissions?.length || 0;

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!user) return <div className="text-center py-12 text-gray-500">User not found</div>;

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'roles', label: `Roles (${user.roleAssignments?.length || 0})` },
    { key: 'permissions', label: `Extra Permissions (${directPermCount})` },
    { key: 'departments', label: `Departments (${user.departmentMemberships?.length || 0})` },
  ];

  return (
    <div>
      <PageHeader
        title={`${user.first_name} ${user.last_name}`}
        subtitle={user.email}
        backTo="/users"
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => navigate(`/users/${id}/edit`)}>Edit</Button>
            {user.status === 'ACTIVE' && (
              <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Deactivate</Button>
            )}
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-6">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ═══ PROFILE ═══ */}
          {tab === 'profile' && (
            <div className="space-y-6">
              {/* Identity strip */}
              <div className="flex items-center gap-4 pb-5 border-b border-gray-100">
                <div className="inline-flex w-14 h-14 rounded-full bg-primary-100 text-primary-700 items-center justify-center text-lg font-semibold flex-shrink-0">
                  {initialsOf(user.first_name, user.last_name, user.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-lg font-semibold text-gray-900 truncate">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-sm text-gray-500 truncate flex items-center gap-1.5">
                    <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zm0 0c0 1.657 1.007 3 2.25 3S21 13.657 21 12a9 9 0 10-2.636 6.364M16.5 12V8.25" />
                    </svg>
                    {user.email}
                  </div>
                </div>
                <StatusBadge status={user.status} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Personal info card */}
                <section className="rounded-lg border border-gray-200 bg-gray-50/40 px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Personal info</h3>
                  <dl className="divide-y divide-gray-100">
                    <Field label="Job title" value={user.profile?.job_title} />
                    <Field label="Employee ID" value={user.profile?.employee_id} />
                    <Field label="Phone" value={user.phone} />
                    <Field label="Location" value={user.profile?.location} />
                    <Field label="Date of joining" value={user.profile?.date_of_joining ? formatDate(user.profile.date_of_joining) : null} />
                    {user.profile?.bio && <Field label="Bio" value={user.profile.bio} />}
                  </dl>
                </section>

                {/* Profession card */}
                <section className="rounded-lg border border-gray-200 bg-gray-50/40 px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Profession</h3>
                  <dl className="divide-y divide-gray-100">
                    <Field
                      label="Role category"
                      value={user.profile?.roleCategory?.name
                        ? <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium">{user.profile.roleCategory.name}</span>
                        : null}
                    />
                    <Field
                      label="Reports to"
                      value={user.profile?.manager
                        ? <a href={`/users/${user.profile.manager.user_id}`} className="text-primary-600 hover:underline font-medium">{user.profile.manager.first_name} {user.profile.manager.last_name}</a>
                        : null}
                    />
                  </dl>
                </section>

                {/* Account card */}
                <section className="rounded-lg border border-gray-200 bg-gray-50/40 px-5 py-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Account</h3>
                  <dl className="divide-y divide-gray-100">
                    <Field
                      label="Email"
                      value={
                        <span className="inline-flex items-center gap-1.5">
                          <span>{user.email}</span>
                          <svg className="w-3 h-3 text-gray-400" title="Email is the login identity and can't be changed" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                          </svg>
                        </span>
                      }
                    />
                    <Field
                      label="Email verified"
                      value={
                        user.email_verified
                          ? <span className="inline-flex items-center gap-1 text-emerald-600">✓ Verified</span>
                          : <span className="inline-flex items-center gap-1 text-amber-600">Pending</span>
                      }
                    />
                    <Field
                      label="Member since"
                      value={formatDate(user.created_at || user.createdAt)}
                    />
                    <Field
                      label="Last login"
                      value={(user.last_login_at || user.lastLoginAt) ? formatDateTime(user.last_login_at || user.lastLoginAt) : null}
                      hint="Never signed in"
                    />
                    <Field
                      label="Last seen"
                      value={(user.last_seen_at || user.lastSeenAt) ? formatRelativeTime(user.last_seen_at || user.lastSeenAt) : null}
                      hint="—"
                    />
                  </dl>
                </section>
              </div>
            </div>
          )}

          {/* ═══ ROLES ═══ */}
          {tab === 'roles' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {user.roleAssignments?.length || 0} role{(user.roleAssignments?.length || 0) !== 1 ? 's' : ''} assigned
                </p>
                <Button variant="secondary" size="sm" onClick={() => setShowAssignForm(!showAssignForm)}>
                  {showAssignForm ? 'Cancel' : '+ Assign Role'}
                </Button>
              </div>

              {showAssignForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Assign a New Role</h4>
                  <Select label="Role" name="assign_role" value={assignRoleId}
                    onChange={(e) => setAssignRoleId(e.target.value)}
                    options={assignableRoleOptions} placeholder="Select a role..." />

                  {assignRoleId && (
                    <>
                      <div className="p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs text-gray-500 mb-2">Assign at scope:</p>
                        <ScopePicker scopeType={assignScopeType} scopeId={assignScopeId}
                          onScopeTypeChange={setAssignScopeType} onScopeIdChange={setAssignScopeId} />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleAssignRole} loading={assigning} size="md">Assign Role</Button>
                      </div>
                    </>
                  )}

                  {assignPickerRole && modules.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Permissions in {assignPickerRole.name}
                      </h5>
                      <PermissionMatrix modules={modules} selectedPermissions={assignPickerPerms} disabled />
                    </div>
                  )}
                </div>
              )}

              {user.roleAssignments?.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No roles assigned.</p>
              ) : (
                <div className="space-y-3">
                  {user.roleAssignments.map((a) => (
                    <RoleCard key={a.assignment_id} assignment={a} allRoles={allRoles}
                      modules={modules} onRemove={handleRemoveRole} removing={removing} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ EXTRA PERMISSIONS ═══ */}
          {tab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">
                    {directPermCount} extra permission{directPermCount !== 1 ? 's' : ''} assigned
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Individual permissions granted beyond what their roles provide.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowPermForm(!showPermForm)}>
                  {showPermForm ? 'Cancel' : '+ Add Permission'}
                </Button>
              </div>

              {showPermForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <h4 className="text-sm font-semibold text-gray-900">Grant an Extra Permission</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Module" name="perm_module" value={permModuleId}
                      onChange={(e) => { setPermModuleId(e.target.value); setPermActionId(''); setPermScopes([]); }}
                      options={moduleOptions} placeholder="Select module..." />
                    <Select label="Action" name="perm_action" value={permActionId}
                      onChange={(e) => setPermActionId(e.target.value)}
                      options={actionOptions}
                      placeholder={permModuleId ? 'Select action...' : 'Select module first'}
                      disabled={!permModuleId} />
                  </div>
                  {permActionId && (
                    <div className="p-3 bg-white rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-500 mb-2">Apply at scope:</p>
                      <HierarchyScopeSelector value={permScopes} onChange={setPermScopes} />
                    </div>
                  )}
                  {permActionId && (
                    <div className="flex justify-end">
                      <Button onClick={handleAssignPermission} loading={addingPerm} size="md">Grant Permission</Button>
                    </div>
                  )}
                </div>
              )}

              {directPermCount === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No extra permissions. Use this to grant individual permissions without assigning a full role.
                </p>
              ) : (
                <div className="space-y-2">
                  {user.directPermissions.map((perm) => (
                    <DirectPermissionRow key={perm.user_permission_id} perm={perm}
                      scopeLabel={findScopeLabel(orgTree, perm.scope_type, perm.scope_id)}
                      onRemove={handleRemovePermission} removing={removingPerm} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ DEPARTMENTS ═══ */}
          {tab === 'departments' && (
            <div className="space-y-3">
              {user.departmentMemberships?.length === 0 ? (
                <p className="text-sm text-gray-500">No department memberships</p>
              ) : (
                user.departmentMemberships.map((m) => (
                  <div key={m.membership_id || m.department_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{m.department?.name}</div>
                      <div className="text-xs text-gray-500">{m.path || m.department?.path || 'Department scope'}</div>
                      {m.source && <div className="text-xs text-gray-400 mt-1">{m.source}</div>}
                    </div>
                    {m.is_primary && <Badge variant="success" size="sm">Primary</Badge>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={handleDeactivate}
        loading={deleting} title="Deactivate User"
        message={`Deactivate "${user.first_name} ${user.last_name}"? They will lose access immediately.`} />
    </div>
  );
}
