import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Input from '../../components/common/Input';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

const DEFAULT_ORGANISATION_ID = 1;

const SCOPE_TYPE_OPTIONS = [
  { value: 'ORGANISATION', label: 'Organisation' },
  { value: 'OFFICE_LOCATION', label: 'Office Location' },
  { value: 'VERTICAL', label: 'Vertical' },
  { value: 'DEPARTMENT', label: 'Department' },
];

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
      {/* Role header */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3 min-w-0">
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
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {modules.length > 0 && permCount > 0 && (
            <button
              onClick={() => setShowPerms(!showPerms)}
              className="text-xs font-medium text-primary-600 hover:text-primary-800 transition-colors"
            >
              {showPerms ? 'Hide permissions' : 'View permissions'}
            </button>
          )}
          {!assignment.role?.is_system && !role?.is_system && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onRemove(assignment.assignment_id)}
              loading={removing === assignment.assignment_id}
              className="text-red-500 hover:text-red-700 hover:bg-red-50"
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      {/* Expandable permissions */}
      {showPerms && modules.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-4">
          <PermissionMatrix
            modules={modules}
            selectedPermissions={permissionIds}
            disabled
          />
        </div>
      )}
    </div>
  );
}

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Roles data
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [removing, setRemoving] = useState(null); // assignment_id being removed

  // Assign role form
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopeType, setAssignScopeType] = useState('ORGANISATION');
  const [assignScopeId, setAssignScopeId] = useState(String(DEFAULT_ORGANISATION_ID));
  const [assigning, setAssigning] = useState(false);

  // ── Fetch user ──
  const fetchUser = useCallback(() => {
    const params = { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID };
    setLoading(true);
    userService.getUser(id, params)
      .then((res) => setUser(res.data?.data))
      .catch(() => addToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  // ── Fetch roles + modules (for permissions display) ──
  useEffect(() => {
    roleService.getRoles({ limit: 100 })
      .then((res) => setAllRoles(res.data?.data?.roles || []))
      .catch(() => {});
    roleService.getModules()
      .then((res) => setModules(res.data?.data || []))
      .catch(() => {});
  }, []);

  // ── Deactivate ──
  const handleDeactivate = async () => {
    setDeleting(true);
    try {
      await userService.deleteUser(id);
      addToast('User deactivated', 'success');
      navigate('/users');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to deactivate', 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  // ── Assign role ──
  const handleAssignRole = async () => {
    if (!assignRoleId) return;
    setAssigning(true);
    try {
      await userService.assignRole(id, {
        role_id: Number(assignRoleId),
        scope_type: assignScopeType,
        scope_id: Number(assignScopeId) || DEFAULT_ORGANISATION_ID,
      });
      addToast('Role assigned successfully', 'success');
      setAssignRoleId('');
      setShowAssignForm(false);
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to assign role', 'error');
    } finally {
      setAssigning(false);
    }
  };

  // ── Remove role ──
  const handleRemoveRole = async (assignmentId) => {
    setRemoving(assignmentId);
    try {
      await userService.removeRole(id, assignmentId);
      addToast('Role removed successfully', 'success');
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove role', 'error');
    } finally {
      setRemoving(null);
    }
  };

  // ── Role dropdown options (exclude already assigned) ──
  const assignableRoleOptions = useMemo(() => {
    const assignedRoleIds = new Set(
      (user?.roleAssignments || []).map((a) => a.role_id || a.role?.role_id)
    );
    return allRoles
      .filter((r) => !assignedRoleIds.has(r.role_id))
      .map((r) => ({ value: String(r.role_id), label: `${r.name}${r.is_system ? ' (System)' : ''}` }));
  }, [allRoles, user?.roleAssignments]);

  // Preview permissions for selected role in assign form
  const assignPickerRole = assignRoleId ? allRoles.find((r) => r.role_id === Number(assignRoleId)) : null;
  const assignPickerPerms = useMemo(() => extractPermissionIds(assignPickerRole), [assignPickerRole]);

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!user) return <div className="text-center py-12 text-gray-500">User not found</div>;

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'roles', label: `Roles (${user.roleAssignments?.length || 0})` },
    { key: 'departments', label: `Departments (${user.departmentMemberships?.length || 0})` },
  ];

  return (
    <div>
      <PageHeader
        title={`${user.first_name} ${user.last_name}`}
        subtitle={user.email}
        actions={
          user.status === 'ACTIVE' && (
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Deactivate</Button>
          )
        }
      />

      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-6">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ════════ PROFILE TAB ════════ */}
          {tab === 'profile' && (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Status</dt><dd className="mt-1"><StatusBadge status={user.status} /></dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="mt-1 font-medium">{user.phone || '—'}</dd></div>
              <div><dt className="text-gray-500">Job Title</dt><dd className="mt-1 font-medium">{user.profile?.job_title || '—'}</dd></div>
              <div><dt className="text-gray-500">Employee ID</dt><dd className="mt-1 font-medium">{user.profile?.employee_id || '—'}</dd></div>
              <div><dt className="text-gray-500">Created</dt><dd className="mt-1 font-medium">{formatDate(user.created_at)}</dd></div>
            </dl>
          )}

          {/* ════════ ROLES TAB ════════ */}
          {tab === 'roles' && (
            <div className="space-y-4">
              {/* Assign role action */}
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  {user.roleAssignments?.length || 0} role{(user.roleAssignments?.length || 0) !== 1 ? 's' : ''} assigned
                </p>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAssignForm(!showAssignForm)}
                >
                  {showAssignForm ? 'Cancel' : '+ Assign Role'}
                </Button>
              </div>

              {/* Assign role form */}
              {showAssignForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-4">
                  <h4 className="text-sm font-semibold text-gray-900">Assign a New Role</h4>
                  <div className="flex items-end gap-3">
                    <Select
                      label="Role"
                      name="assign_role"
                      value={assignRoleId}
                      onChange={(e) => setAssignRoleId(e.target.value)}
                      options={assignableRoleOptions}
                      placeholder="Select a role..."
                      className="flex-1"
                    />
                    <Select
                      label="Scope"
                      name="assign_scope_type"
                      value={assignScopeType}
                      onChange={(e) => setAssignScopeType(e.target.value)}
                      options={SCOPE_TYPE_OPTIONS}
                      className="w-44"
                    />
                    <Input
                      label="Scope ID"
                      name="assign_scope_id"
                      type="number"
                      value={assignScopeId}
                      onChange={(e) => setAssignScopeId(e.target.value)}
                      className="w-24"
                    />
                    <Button
                      onClick={handleAssignRole}
                      loading={assigning}
                      disabled={!assignRoleId}
                      size="md"
                    >
                      Assign
                    </Button>
                  </div>

                  {/* Permission preview for selected role */}
                  {assignPickerRole && modules.length > 0 && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-white">
                      <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Permissions in {assignPickerRole.name}
                      </h5>
                      <PermissionMatrix
                        modules={modules}
                        selectedPermissions={assignPickerPerms}
                        disabled
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Existing role assignments */}
              {user.roleAssignments?.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">
                  No roles assigned. Click &ldquo;Assign Role&rdquo; to add one.
                </p>
              ) : (
                <div className="space-y-3">
                  {user.roleAssignments.map((a) => (
                    <RoleCard
                      key={a.assignment_id}
                      assignment={a}
                      allRoles={allRoles}
                      modules={modules}
                      onRemove={handleRemoveRole}
                      removing={removing}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ════════ DEPARTMENTS TAB ════════ */}
          {tab === 'departments' && (
            <div className="space-y-3">
              {user.departmentMemberships?.length === 0 ? (
                <p className="text-sm text-gray-500">No department memberships</p>
              ) : (
                user.departmentMemberships.map((m) => (
                  <div key={m.department_membership_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{m.department?.name}</div>
                      <div className="text-xs text-gray-500">{m.department?.path}</div>
                    </div>
                    {m.is_primary && <Badge variant="success" size="sm">Primary</Badge>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDeactivate}
        loading={deleting}
        title="Deactivate User"
        message={`Deactivate "${user.first_name} ${user.last_name}"? They will lose access immediately.`}
      />
    </div>
  );
}
