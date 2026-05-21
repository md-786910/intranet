import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { getPermLabel } from '../../components/roles/PermissionMatrix';
import ReportsToPicker from '../employees/ReportsToPicker';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { roleCategoryService } from '../../services/roleCategoryService';
import { jobTitleService } from '../../services/jobTitleService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

function isSameRoleAssignment(left, right) {
  return left.role_id === right.role_id
    && left.scope_type === right.scope_type
    && left.scope_id === right.scope_id;
}

function isSamePermissionAssignment(left, right) {
  return left.module_action_id === right.module_action_id
    && left.scope_type === right.scope_type
    && left.scope_id === right.scope_id;
}

function formatScopeLabel(scopeLabel, scopeType, scopeId) {
  if (scopeLabel) return scopeLabel;
  return `${scopeType.replace(/_/g, ' ')} #${scopeId}`;
}

function buildDraftRoleAssignments(allRoles, pickerRoleId, pickerScopes, currentOrganisationId) {
  if (!pickerRoleId) return [];

  const role = allRoles.find((item) => item.role_id === Number(pickerRoleId));
  if (!role) return [];

  const scopes = pickerScopes.length > 0
    ? pickerScopes
    : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId, scope_label: 'Organisation' }];

  return scopes.map((scope) => ({
    role_id: role.role_id,
    role_name: role.name,
    is_system: role.is_system,
    scope_type: scope.scope_type,
    scope_id: scope.scope_id || currentOrganisationId,
    scope_label: scope.scope_label,
  }));
}

function buildDraftPermissions(modules, permModuleId, permActionId, permScopes, currentOrganisationId) {
  if (!permActionId) return [];

  const mod = modules.find((item) => item.module_id === Number(permModuleId));
  const action = mod?.actions.find((item) => item.module_action_id === Number(permActionId));
  if (!mod || !action) return [];

  const { label } = getPermLabel(mod.code, action.action_code);
  const scopes = permScopes.length > 0
    ? permScopes
    : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId, scope_label: 'Organisation' }];

  return scopes.map((scope) => ({
    module_action_id: action.module_action_id,
    module_name: mod.name,
    action_label: label,
    scope_type: scope.scope_type,
    scope_id: scope.scope_id || currentOrganisationId,
    scope_label: scope.scope_label,
  }));
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

export default function UserCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();

  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '',
    employee_id: '', date_of_joining: '', bio: '', location: '',
  });
  const [jobTitleId, setJobTitleId] = useState('');
  const [roleCategoryId, setRoleCategoryId] = useState('');
  const [reportsTo, setReportsTo] = useState(null);
  const [jobTitles, setJobTitles] = useState([]);
  const [roleCategories, setRoleCategories] = useState([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // Roles + modules
  const [allRoles, setAllRoles] = useState([]);
  const [modules, setModules] = useState([]);
  const [assignedRoles, setAssignedRoles] = useState([]);
  const [pickerRoleId, setPickerRoleId] = useState('');
  const [pickerScopes, setPickerScopes] = useState([]);
  const [previewRoleIndex, setPreviewRoleIndex] = useState(null);

  // Extra permissions
  const [extraPerms, setExtraPerms] = useState([]);
  const [permModuleId, setPermModuleId] = useState('');
  const [permActionId, setPermActionId] = useState('');
  const [permScopes, setPermScopes] = useState([]);
  const [showPermForm, setShowPermForm] = useState(false);

  useEffect(() => {
    roleService.getRoles({ limit: 100 }).then((res) => setAllRoles(res.data?.data?.roles || [])).catch(() => {});
    roleService.getModules().then((res) => setModules(res.data?.data || [])).catch(() => {});
    jobTitleService.list().then((res) => setJobTitles(res.data?.data || [])).catch(() => {});
    roleCategoryService.list().then((res) => setRoleCategories(res.data?.data || [])).catch(() => {});
  }, []);

  // ── Derived ──
  const roleOptions = useMemo(() => {
    return allRoles
      .map((r) => ({ value: String(r.role_id), label: `${r.name}${r.is_system ? ' (System)' : ''}` }));
  }, [allRoles]);

  const pickerRole = pickerRoleId ? allRoles.find((r) => r.role_id === Number(pickerRoleId)) : null;
  const pickerPermissions = useMemo(() => extractPermissionIds(pickerRole), [pickerRole]);

  const previewPermissions = useMemo(() => {
    if (previewRoleIndex === null || !assignedRoles[previewRoleIndex]) return new Set();
    const role = allRoles.find((r) => r.role_id === assignedRoles[previewRoleIndex].role_id);
    return extractPermissionIds(role);
  }, [previewRoleIndex, assignedRoles, allRoles]);

  const moduleOptions = useMemo(() => modules.map((m) => ({ value: String(m.module_id), label: m.name })), [modules]);
  const actionOptions = useMemo(() => {
    if (!permModuleId) return [];
    const mod = modules.find((m) => m.module_id === Number(permModuleId));
    if (!mod) return [];
    return mod.actions
      .map((a) => { const { label } = getPermLabel(mod.code, a.action_code); return { value: String(a.module_action_id), label }; });
  }, [permModuleId, modules]);

  // ── Handlers ──
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleAddRole = () => {
    if (!pickerRoleId) return;
    const roleId = Number(pickerRoleId);
    const role = allRoles.find((r) => r.role_id === roleId);
    if (!role) return;

    const scopesToAdd = pickerScopes.length > 0
      ? pickerScopes
      : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId, scope_label: 'Organisation' }];

    setAssignedRoles((prev) => {
      const nextAssignments = scopesToAdd
        .map((scope) => ({
          role_id: roleId,
          role_name: role.name,
          is_system: role.is_system,
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || currentOrganisationId,
          scope_label: scope.scope_label,
        }))
        .filter((assignment) => !prev.some((existing) => isSameRoleAssignment(existing, assignment)));

      return nextAssignments.length > 0 ? [...prev, ...nextAssignments] : prev;
    });

    setPickerRoleId('');
    setPickerScopes([]);
  };

  const handleRemoveRole = (index) => {
    setAssignedRoles((prev) => prev.filter((_, i) => i !== index));
    if (previewRoleIndex === index) setPreviewRoleIndex(null);
    else if (previewRoleIndex !== null && previewRoleIndex > index) setPreviewRoleIndex(previewRoleIndex - 1);
  };

  const handleAddPerm = () => {
    if (!permActionId) return;
    const mod = modules.find((m) => m.module_id === Number(permModuleId));
    const action = mod?.actions.find((a) => a.module_action_id === Number(permActionId));
    if (!mod || !action) return;
    const { label } = getPermLabel(mod.code, action.action_code);

    const scopesToAdd = permScopes.length > 0
      ? permScopes
      : [{ scope_type: 'ORGANISATION', scope_id: currentOrganisationId, scope_label: 'Organisation' }];

    setExtraPerms((prev) => {
      const nextPermissions = scopesToAdd
        .map((scope) => ({
          module_action_id: Number(permActionId),
          module_name: mod.name,
          action_label: label,
          scope_type: scope.scope_type,
          scope_id: scope.scope_id || currentOrganisationId,
          scope_label: scope.scope_label,
        }))
        .filter((permission) => !prev.some((existing) => isSamePermissionAssignment(existing, permission)));

      return nextPermissions.length > 0 ? [...prev, ...nextPermissions] : prev;
    });

    setPermActionId('');
    setPermModuleId('');
    setPermScopes([]);
    setShowPermForm(false);
  };

  const handleRemovePerm = (index) => {
    setExtraPerms((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.password) newErrors.password = 'Password is required';
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (!currentOrganisationId) newErrors.organisation = 'Active organisation is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const draftRoles = buildDraftRoleAssignments(allRoles, pickerRoleId, pickerScopes, currentOrganisationId);
      const finalRoles = [...assignedRoles];
      draftRoles.forEach((assignment) => {
        if (!finalRoles.some((existing) => isSameRoleAssignment(existing, assignment))) {
          finalRoles.push(assignment);
        }
      });

      const draftPermissions = buildDraftPermissions(modules, permModuleId, permActionId, permScopes, currentOrganisationId);
      const finalPermissions = [...extraPerms];
      draftPermissions.forEach((permission) => {
        if (!finalPermissions.some((existing) => isSamePermissionAssignment(existing, permission))) {
          finalPermissions.push(permission);
        }
      });

      await userService.createUser({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        scope_type: 'ORGANISATION',
        scope_id: currentOrganisationId,
        profile: {
          job_title: jobTitleId ? jobTitles.find((t) => t.id === Number(jobTitleId))?.name || undefined : undefined,
          employee_id: form.employee_id || undefined,
          date_of_joining: form.date_of_joining || undefined,
          bio: form.bio || undefined,
          location: form.location || undefined,
          role_category_id: roleCategoryId ? Number(roleCategoryId) : undefined,
          reports_to_user_id: reportsTo?.user_id || undefined,
        },
        initial_roles: finalRoles.length > 0
          ? finalRoles.map((a) => ({ role_id: a.role_id, scope_type: a.scope_type, scope_id: a.scope_id }))
          : undefined,
        initial_permissions: finalPermissions.length > 0
          ? finalPermissions.map((p) => ({ module_action_id: p.module_action_id, scope_type: p.scope_type, scope_id: p.scope_id }))
          : undefined,
      });
      addToast('User created successfully', 'success');
      navigate('/users');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to create user'), 'error');
      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) setErrors(validationErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Create User" subtitle="Add a new user account." backTo="/users" />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 space-y-5">
          {/* ── Account ── */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="first_name" required value={form.first_name}
              error={errors.first_name} onChange={handleChange} />
            <Input label="Last Name" name="last_name" required value={form.last_name}
              error={errors.last_name} onChange={handleChange} />
          </div>
          <Input label="Email" name="email" type="email" required value={form.email}
            error={errors.email} onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Password" name="password" type="password" required value={form.password}
              error={errors.password} onChange={handleChange} helpText="Minimum 6 characters" />
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          </div>

          {/* ── Profile ── */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              {jobTitles.length > 0 ? (
                <Select
                  label="Job Title"
                  name="job_title"
                  value={jobTitleId}
                  onChange={(e) => setJobTitleId(e.target.value)}
                  options={jobTitles.map((t) => ({ value: String(t.id), label: t.name }))}
                  placeholder="Select a job title…"
                />
              ) : (
                <Input label="Job Title" name="job_title"
                  value={form.job_title || ''}
                  onChange={(e) => setForm({ ...form, job_title: e.target.value })} />
              )}
              <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Select
                label="Role Category"
                name="role_category"
                value={roleCategoryId}
                onChange={(e) => setRoleCategoryId(e.target.value)}
                options={roleCategories.map((c) => ({ value: String(c.id), label: c.name }))}
                placeholder="Select role category…"
              />
              <Input label="Date of Joining" name="date_of_joining" type="date"
                value={form.date_of_joining} onChange={handleChange} />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Reports To</label>
              <ReportsToPicker value={reportsTo} onChange={setReportsTo} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input label="Location" name="location" value={form.location} onChange={handleChange}
                placeholder="e.g. New York Office" />
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
              <textarea
                name="bio"
                value={form.bio}
                onChange={handleChange}
                rows={3}
                placeholder="Short bio…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          {/* ── Roles ── */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Roles</h3>

            {assignedRoles.length > 0 && (
              <div className="space-y-2 mb-3">
                {assignedRoles.map((a, i) => (
                  <div key={i}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      previewRoleIndex === i ? 'border-primary-200 bg-primary-50/50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setPreviewRoleIndex(previewRoleIndex === i ? null : i)}>
                    <div>
                      <span className="text-sm font-medium text-gray-900">{a.role_name}</span>
                      {a.is_system && <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">System</span>}
                      <div className="text-xs text-gray-500 mt-0.5">{formatScopeLabel(a.scope_label, a.scope_type, a.scope_id)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">{previewRoleIndex === i ? 'Hide' : 'View'} permissions</span>
                      <button onClick={(e) => { e.stopPropagation(); handleRemoveRole(i); }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {previewRoleIndex !== null && modules.length > 0 && (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Permissions in {assignedRoles[previewRoleIndex].role_name}
                    </h4>
                    <PermissionMatrix modules={modules} selectedPermissions={previewPermissions} disabled />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end gap-3">
              <Select label="Role" name="role" value={pickerRoleId}
                onChange={(e) => setPickerRoleId(e.target.value)}
                options={roleOptions} placeholder="Select a role..." className="flex-1" />
              <Button variant="secondary" size="md" onClick={handleAddRole} disabled={!pickerRoleId}>Add</Button>
            </div>

            {pickerRoleId && (
              <>
                <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">Assign at one or more scopes:</p>
                  <HierarchyScopeSelector value={pickerScopes} onChange={setPickerScopes} />
                </div>
                {pickerRole && modules.length > 0 && (
                  <div className="mt-3 border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/30">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Permissions in {pickerRole.name}
                    </h4>
                    <PermissionMatrix modules={modules} selectedPermissions={pickerPermissions} disabled />
                  </div>
                )}
              </>
            )}
          </div>

          {/* ── Extra Permissions ── */}
          <div className="border-t border-gray-100 pt-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-medium text-gray-700">Extra Permissions</h3>
                <p className="text-xs text-gray-400 mt-0.5">Individual permissions beyond what roles provide.</p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowPermForm(!showPermForm)}>
                {showPermForm ? 'Cancel' : '+ Add'}
              </Button>
            </div>

            {showPermForm && (
              <div className="border border-dashed border-primary-200 bg-primary-50/30 rounded-lg p-4 space-y-3 mb-3">
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
                    <p className="text-xs text-gray-500 mb-3">Apply at one or more scopes:</p>
                    <HierarchyScopeSelector value={permScopes} onChange={setPermScopes} />
                  </div>
                )}
                {permActionId && (
                  <div className="flex justify-end">
                    <Button size="md" onClick={handleAddPerm}>Add Permission</Button>
                  </div>
                )}
              </div>
            )}

            {extraPerms.length > 0 && (
              <div className="space-y-2">
                {extraPerms.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{p.action_label}</div>
                      <div className="text-xs text-gray-500">{p.module_name} · {formatScopeLabel(p.scope_label, p.scope_type, p.scope_id)}</div>
                    </div>
                    <button onClick={() => handleRemovePerm(i)}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <Button variant="secondary" onClick={() => navigate('/users')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create User</Button>
        </div>
      </div>
    </div>
  );
}
