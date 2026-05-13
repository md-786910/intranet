import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Badge from '../../components/common/Badge';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { useOrgTree } from '../../hooks/useOrgTree';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { findScopeLabel } from '../../utils/scopeLabel';

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
function RoleCard({ assignment, allRoles, modules, scopeLabel, onRemove, removing }) {
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
            {scopeLabel || `${assignment.scope_type.replace(/_/g, ' ')} #${assignment.scope_id}`}
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
  const { tree: orgTree } = useOrgTree();

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

  // Assign role — supports multi-scope assignment to mirror the Create flow.
  // `assignScopes` is an array of { scope_type, scope_id, scope_label }.
  const [showAssignForm, setShowAssignForm] = useState(false);
  const [assignRoleId, setAssignRoleId] = useState('');
  const [assignScopes, setAssignScopes] = useState([]);
  const [assigning, setAssigning] = useState(false);

  // Inline scope-edit on the Profile summary. Group role_assignments by
  // role_id and edit all of one role's scopes together — picking N scopes
  // in the editor replaces ALL existing assignments for that role with
  // those N new ones.
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [editScopes, setEditScopes] = useState([]);
  const [savingScope, setSavingScope] = useState(false);

  // Direct permissions — same multi-scope shape as roles.
  const [showPermForm, setShowPermForm] = useState(false);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopes, setPermScopes] = useState([]);
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
    // No scopes selected → default to Organisation (mirrors Create's behaviour).
    const scopes = assignScopes.length > 0
      ? assignScopes
      : [{ scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID }];

    setAssigning(true);
    try {
      for (const scope of scopes) {
        // eslint-disable-next-line no-await-in-loop
        await userService.assignRole(id, {
          role_id: Number(assignRoleId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
        });
      }
      addToast(scopes.length === 1 ? 'Role assigned' : `Role assigned at ${scopes.length} scopes`, 'success');
      setAssignRoleId('');
      setAssignScopes([]);
      setShowAssignForm(false);
      fetchUser();
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

  // Inline-edit all scopes for a single role at once. Pre-fills the
  // selector with every current scope assigned for that role, then on save
  // diffs against the new picks: remove old assignments that aren't in the
  // new set, add new assignments that aren't in the old set, leave matching
  // ones alone (cheaper + avoids a momentary "no access" window).
  const beginEditScopesForRole = (group) => {
    setEditingRoleId(group.roleId);
    setEditScopes(group.assignments.map((a) => ({
      scope_type: a.scope_type,
      scope_id: a.scope_id,
      scope_label: findScopeLabel(orgTree, a.scope_type, a.scope_id) || `${a.scope_type}: #${a.scope_id}`,
    })));
  };

  const cancelEditScope = () => {
    setEditingRoleId(null);
    setEditScopes([]);
  };

  const handleSaveScope = async (group) => {
    if (editScopes.length === 0) {
      addToast('Pick at least one scope', 'error');
      return;
    }
    const roleId = group.roleId;
    setSavingScope(true);
    try {
      // Diff existing vs new. Use a "TYPE:ID" key to compare.
      const keyOf = (s) => `${s.scope_type}:${s.scope_id}`;
      const existingKeys = new Set(group.assignments.map(keyOf));
      const newKeys = new Set(editScopes.map(keyOf));

      const toRemove = group.assignments.filter((a) => !newKeys.has(keyOf(a)));
      const toAdd = editScopes.filter((s) => !existingKeys.has(keyOf(s)));

      for (const a of toRemove) {
        // eslint-disable-next-line no-await-in-loop
        await userService.removeRole(id, a.assignment_id);
      }
      for (const scope of toAdd) {
        // eslint-disable-next-line no-await-in-loop
        await userService.assignRole(id, {
          role_id: Number(roleId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
        });
      }

      if (toRemove.length === 0 && toAdd.length === 0) {
        addToast('No changes to save', 'info');
      } else {
        addToast(`Saved — ${editScopes.length} scope${editScopes.length === 1 ? '' : 's'} assigned`, 'success');
      }
      cancelEditScope();
      fetchUser();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update scopes', 'error');
    } finally {
      setSavingScope(false);
    }
  };

  // ── Permission handlers ──
  const handleAssignPerm = async () => {
    if (!permActionId) return;
    const scopes = permScopes.length > 0
      ? permScopes
      : [{ scope_type: 'ORGANISATION', scope_id: DEFAULT_ORGANISATION_ID }];

    setAddingPerm(true);
    try {
      for (const scope of scopes) {
        // eslint-disable-next-line no-await-in-loop
        await userService.assignPermission(id, {
          module_action_id: Number(permActionId),
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || DEFAULT_ORGANISATION_ID,
        });
      }
      addToast(scopes.length === 1 ? 'Permission granted' : `Permission granted at ${scopes.length} scopes`, 'success');
      setPermActionId('');
      setPermModuleId('');
      setPermScopes([]);
      setShowPermForm(false);
      fetchUser();
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
    { key: 'departments', label: `Departments (${user.departmentMemberships?.length || 0})` },
  ];

  return (
    <div>
      <PageHeader title={`Edit: ${user.first_name} ${user.last_name}`} subtitle={user.email} backTo={`/users/${id}`} />

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
            <div className="space-y-5">
              <Input
                label="Email"
                name="email"
                value={user.email}
                disabled
                helpText="Email is the login identity and can't be changed. To assign a different email, deactivate this account and create a new one."
              />
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" name="first_name" required value={form.first_name}
                  error={errors.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" required value={form.last_name}
                  error={errors.last_name} onChange={handleChange} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Phone" name="phone" value={form.phone} onChange={handleChange}
                  placeholder="e.g. +91 98765 43210" />
                <Select label="Status" name="status" value={form.status}
                  onChange={handleChange} options={STATUS_OPTIONS} />
              </div>
              <div className="border-t border-gray-100 pt-5">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Profile</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Input label="Job Title" name="job_title" value={form.job_title} onChange={handleChange}
                    placeholder="e.g. Senior Engineer" />
                  <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange}
                    placeholder="e.g. EMP-00123" />
                </div>
              </div>

              {/* Roles & org hierarchy — full width tree picker. */}
              <div className="border-t border-gray-100 pt-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-700">Roles &amp; org hierarchy</h3>
                  <button
                    type="button"
                    onClick={() => setTab('roles')}
                    className="text-xs font-medium text-primary-600 hover:text-primary-700"
                  >
                    Manage roles &rarr;
                  </button>
                </div>
                {(user.roleAssignments || []).length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No roles assigned yet — go to the Roles tab to assign one.</p>
                ) : (
                  <ul className="space-y-2">
                    {(() => {
                      // Group assignments by role so the user sees one row per
                      // role with all its scopes listed (and edited) together.
                      const groups = new Map();
                      (user.roleAssignments || []).forEach((a) => {
                        const roleId = a.role_id || a.role?.role_id;
                        if (!roleId) return;
                        if (!groups.has(roleId)) {
                          groups.set(roleId, {
                            roleId,
                            role: a.role || null,
                            isSystem: a.role?.is_system || false,
                            assignments: [],
                          });
                        }
                        groups.get(roleId).assignments.push(a);
                      });

                      return Array.from(groups.values()).map((group) => {
                        const isEditing = editingRoleId === group.roleId;
                        return (
                          <li key={group.roleId} className="rounded-lg bg-gray-50 border border-gray-200">
                            <div className="flex items-start gap-3 px-3 py-2">
                              <Badge variant={group.isSystem ? 'info' : 'default'} size="sm">
                                {group.role?.name || 'Role'}
                              </Badge>
                              <ul className="flex-1 min-w-0 space-y-0.5">
                                {group.assignments.map((a) => {
                                  const label = findScopeLabel(orgTree, a.scope_type, a.scope_id)
                                    || `${a.scope_type.replace(/_/g, ' ')} #${a.scope_id}`;
                                  return (
                                    <li key={a.assignment_id} className="text-gray-700 text-xs truncate">
                                      {label}
                                    </li>
                                  );
                                })}
                              </ul>
                              {!isEditing && (
                                <button
                                  type="button"
                                  onClick={() => beginEditScopesForRole(group)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-primary-600 hover:text-primary-700 flex-shrink-0"
                                  title="Edit office / vertical / department for this role"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zM19.5 7.125L16.875 4.5" />
                                  </svg>
                                  Change scope
                                </button>
                              )}
                            </div>
                            {isEditing && (
                              <div className="border-t border-gray-200 bg-white px-3 py-3 space-y-3">
                                <p className="text-xs text-gray-500">
                                  Pick the office, vertical, or department scopes this role should apply at.
                                  Removed scopes will be unassigned and new ones added.
                                </p>
                                <HierarchyScopeSelector value={editScopes} onChange={setEditScopes} />
                                <div className="flex items-center justify-end gap-2">
                                  <Button variant="secondary" size="sm" onClick={cancelEditScope} disabled={savingScope}>
                                    Cancel
                                  </Button>
                                  <Button size="sm" onClick={() => handleSaveScope(group)} loading={savingScope}>
                                    {editScopes.length > 1 ? `Save (${editScopes.length} scopes)` : 'Save scope'}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </li>
                        );
                      });
                    })()}
                  </ul>
                )}
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
                        <p className="text-xs text-gray-500 mb-2">Assign at one or more scopes:</p>
                        <HierarchyScopeSelector value={assignScopes} onChange={setAssignScopes} />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleAssignRole} loading={assigning} size="md">
                          {assignScopes.length > 1 ? `Assign Role at ${assignScopes.length} scopes` : 'Assign Role'}
                        </Button>
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
                      modules={modules}
                      scopeLabel={findScopeLabel(orgTree, a.scope_type, a.scope_id)}
                      onRemove={handleRemoveRole} removing={removing} />
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
                      <p className="text-xs text-gray-500 mb-2">Apply at one or more scopes:</p>
                      <HierarchyScopeSelector value={permScopes} onChange={setPermScopes} />
                    </div>
                  )}
                  {permActionId && (
                    <div className="flex justify-end">
                      <Button onClick={handleAssignPerm} loading={addingPerm} size="md">
                        {permScopes.length > 1 ? `Grant at ${permScopes.length} scopes` : 'Grant Permission'}
                      </Button>
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
                    const scopeLabel = findScopeLabel(orgTree, perm.scope_type, perm.scope_id);
                    return (
                      <div key={perm.user_permission_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{label}</div>
                          <div className="text-xs text-gray-500">
                            {moduleName} · {scopeLabel || `${perm.scope_type.replace(/_/g, ' ')} #${perm.scope_id}`}
                          </div>
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

          {/* ═══ DEPARTMENTS TAB ═══ */}
          {tab === 'departments' && (
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                Departments are derived from role assignments at the Department scope.
                To add or remove a department, go to the <button
                  type="button"
                  onClick={() => setTab('roles')}
                  className="text-primary-600 hover:text-primary-700 underline font-medium"
                >Roles tab</button> and assign a role at the desired department.
              </p>
              {(user.departmentMemberships || []).length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center">No department memberships.</p>
              ) : (
                <div className="space-y-2">
                  {user.departmentMemberships.map((m) => (
                    <div key={m.membership_id || m.department_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900">{m.department?.name || 'Department'}</div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {m.path || m.department?.path || 'Department scope'}
                        </div>
                        {m.source && <div className="text-xs text-gray-400 mt-1">{m.source}</div>}
                      </div>
                      {m.is_primary && <Badge variant="success" size="sm">Primary</Badge>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
