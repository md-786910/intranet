import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import ScopePicker from '../../components/common/ScopePicker';
import Badge from '../../components/common/Badge';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const DEFAULT_ORGANISATION_ID = 1;

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function extractPermissionIds(role) {
  if (!role?.permissions) return new Set();
  return new Set(
    role.permissions.filter((p) => p.effect === 'ALLOW')
      .map((p) => p.moduleAction?.module_action_id).filter(Boolean)
  );
}

// ── Role Card (reused from detail page pattern) ──
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
            <span className="text-sm font-medium text-gray-900">{assignment.role?.name || role?.name || 'Unknown'}</span>
            {(assignment.role?.is_system || role?.is_system) && <Badge variant="info" size="sm">System</Badge>}
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
              className="text-red-500 hover:text-red-700 hover:bg-red-50">Remove</Button>
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

export default function UserEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [tab, setTab] = useState('profile');
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);

  // Profile form
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', status: 'ACTIVE',
    job_title: '', employee_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Roles + modules
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [removing, setRemoving] = useState(null);

  // Assign role
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopeType, setAssignScopeType] = useState('ORGANISATION');
  const [assignScopeId, setAssignScopeId] = useState(DEFAULT_ORGANISATION_ID);
  const [assigning, setAssigning] = useState(false);

  // Direct permissions
  const [showPermForm, setShowPermForm] = useState(false);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopeType, setPermScopeType] = useState('ORGANISATION');
  const [permScopeId, setPermScopeId] = useState(DEFAULT_ORGANISATION_ID);
  const [addingPerm, setAddingPerm] = useState(false);
  const [removingPerm, setRemovingPerm] = useState(null);

  // ── Fetch ──
  const fetchUser = useCallback(() => {
    setLoading(true);
    userService.getUser(id, { scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID })
      .then((res) => {
        const u = res.data?.data;
        setUser(u);
        setForm({
          first_name: u.first_name || '', last_name: u.last_name || '',
          phone: u.phone || '', status: u.status || 'ACTIVE',
          job_title: u.profile?.job_title || '', employee_id: u.profile?.employee_id || '',
        });
      })
      .catch(() => addToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchUser(); }, [fetchUser]);

  useEffect(() => {
    roleService.getRoles({ limit: 100 }).then((res) => setAllRoles(res.data?.data?.roles || [])).catch(() => {});
    roleService.getModules().then((res) => setModules(res.data?.data || [])).catch(() => {});
  }, []);

  // ── Profile handlers ──
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleSaveProfile = async () => {
    const newErrors = {};
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      await userService.updateUser(id, {
        first_name: form.first_name, last_name: form.last_name,
        phone: form.phone || undefined, status: form.status,
        profile: { job_title: form.job_title || undefined, employee_id: form.employee_id || undefined },
      });
      addToast('Profile updated', 'success');
      fetchUser();
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to update'), 'error');
      const ve = extractValidationErrors(err);
      if (Object.keys(ve).length > 0) setErrors(ve);
    } finally { setSaving(false); }
  };

  // ── Role handlers ──
  const handleAssignRole = async () => {
    if (!assignRoleId) return;
    setAssigning(true);
    try {
      await userService.assignRole(id, {
        role_id: Number(assignRoleId), scope_type: assignScopeType,
        scope_id: assignScopeId || DEFAULT_ORGANISATION_ID,
      });
      addToast('Role assigned', 'success');
      setAssignRoleId(''); setShowAssignForm(false); fetchUser();
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setAssigning(false); }
  };

  const handleRemoveRole = async (assignmentId) => {
    setRemoving(assignmentId);
    try {
      await userService.removeRole(id, assignmentId);
      addToast('Role removed', 'success'); fetchUser();
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setRemoving(null); }
  };

  // ── Permission handlers ──
  const handleAssignPerm = async () => {
    if (!permActionId) return;
    setAddingPerm(true);
    try {
      await userService.assignPermission(id, {
        module_action_id: Number(permActionId), scope_type: permScopeType,
        scope_id: permScopeId || DEFAULT_ORGANISATION_ID,
      });
      addToast('Permission granted', 'success');
      setPermActionId(''); setPermModuleId(''); setShowPermForm(false); fetchUser();
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setAddingPerm(false); }
  };

  const handleRemovePerm = async (permissionId) => {
    setRemovingPerm(permissionId);
    try {
      await userService.removePermission(id, permissionId);
      addToast('Permission removed', 'success'); fetchUser();
    } catch (err) { addToast(err.response?.data?.message || 'Failed', 'error'); }
    finally { setRemovingPerm(null); }
  };

  // ── Derived ──
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
    const existingIds = new Set((user?.directPermissions || []).map((p) => p.module_action_id));
    return mod.actions.filter((a) => !existingIds.has(a.module_action_id))
      .map((a) => { const { label } = getPermLabel(mod.code, a.action_code); return { value: String(a.module_action_id), label }; });
  }, [permModuleId, modules, user?.directPermissions]);

  const directPermCount = user?.directPermissions?.length || 0;

  if (loading) return <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />;
  if (!user) return <div className="text-center py-12 text-gray-500">User not found</div>;

  const tabs = [
    { key: 'profile', label: 'Profile' },
    { key: 'roles', label: `Roles (${user.roleAssignments?.length || 0})` },
    { key: 'permissions', label: `Extra Permissions (${directPermCount})` },
  ];

  return (
    <div>
      <PageHeader title={`Edit: ${user.first_name} ${user.last_name}`} subtitle={user.email} />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200 px-6">
          <nav className="flex gap-6">
            {tabs.map((t) => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                  tab === t.key ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}>{t.label}</button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* ═══ PROFILE TAB ═══ */}
          {tab === 'profile' && (
            <div className="max-w-lg space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" name="first_name" required value={form.first_name}
                  error={errors.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" required value={form.last_name}
                  error={errors.last_name} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
                <Select label="Status" name="status" value={form.status}
                  onChange={handleChange} options={STATUS_OPTIONS} />
              </div>
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Profile</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Job Title" name="job_title" value={form.job_title} onChange={handleChange} />
                  <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <Button variant="secondary" onClick={() => navigate(`/users/${id}`)}>Cancel</Button>
                <Button onClick={handleSaveProfile} loading={saving}>Save Changes</Button>
              </div>
            </div>
          )}

          {/* ═══ ROLES TAB ═══ */}
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

          {/* ═══ EXTRA PERMISSIONS TAB ═══ */}
          {tab === 'permissions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{directPermCount} extra permission{directPermCount !== 1 ? 's' : ''}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Individual permissions beyond what roles provide.</p>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowPermForm(!showPermForm)}>
                  {showPermForm ? 'Cancel' : '+ Add Permission'}
                </Button>
              </div>

              {showPermForm && (
                <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Select label="Module" name="perm_module" value={permModuleId}
                      onChange={(e) => { setPermModuleId(e.target.value); setPermActionId(''); }}
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
                      <ScopePicker scopeType={permScopeType} scopeId={permScopeId}
                        onScopeTypeChange={setPermScopeType} onScopeIdChange={setPermScopeId} />
                    </div>
                  )}
                  {permActionId && (
                    <div className="flex justify-end">
                      <Button onClick={handleAssignPerm} loading={addingPerm} size="md">Grant Permission</Button>
                    </div>
                  )}
                </div>
              )}

              {directPermCount === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No extra permissions.</p>
              ) : (
                <div className="space-y-2">
                  {user.directPermissions.map((perm) => {
                    const moduleCode = perm.moduleAction?.module?.code || '';
                    const actionCode = perm.moduleAction?.action_code || '';
                    const moduleName = perm.moduleAction?.module?.name || moduleCode;
                    const { label } = getPermLabel(moduleCode, actionCode);
                    return (
                      <div key={perm.user_permission_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500">{moduleName} · {perm.scope_type.replace(/_/g, ' ')} #{perm.scope_id}</div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemovePerm(perm.user_permission_id)}
                          loading={removingPerm === perm.user_permission_id}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50">Remove</Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
