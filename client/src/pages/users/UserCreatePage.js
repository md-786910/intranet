import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import ChatAccessSelector from '../../components/common/ChatAccessSelector';
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
    job_title: '', employee_id: '', role_category_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [setPasswordManually, setSetPasswordManually] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Employee-specific state
  const [reportsTo, setReportsTo] = useState(null);
  const [primaryDeptId, setPrimaryDeptId] = useState('');
  const [roleCategories, setRoleCategories] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [chatCandidates, setChatCandidates] = useState([]);
  const [chatCandidatesLoading, setChatCandidatesLoading] = useState(true);
  const [chatBlockedIds, setChatBlockedIds] = useState([]);

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
    roleCategoryService.list().then((res) => setRoleCategories(res.data?.data || [])).catch(() => {});
    jobTitleService.list().then((res) => setJobTitles(res.data?.data || [])).catch(() => {});
    userService.listChatCandidates()
      .then((res) => setChatCandidates(res.data?.data || []))
      .catch(() => setChatCandidates([]))
      .finally(() => setChatCandidatesLoading(false));
  }, []);

  // ── Derived ──
  const roleCategoryOptions = useMemo(
    () => roleCategories.map((c) => ({ value: String(c.id), label: c.name })),
    [roleCategories],
  );

  const jobTitleOptions = useMemo(
    () => jobTitles.map((t) => ({ value: t.name, label: t.name })),
    [jobTitles],
  );

  // Collect unique department-level scopes from all assigned roles
  const departmentScopes = useMemo(() => {
    const seen = new Set();
    return assignedRoles
      .filter((a) => a.scope_type === 'DEPARTMENT')
      .filter((a) => {
        if (seen.has(a.scope_id)) return false;
        seen.add(a.scope_id);
        return true;
      })
      .map((a) => ({ scope_type: a.scope_type, scope_id: a.scope_id, scope_label: a.scope_label }));
  }, [assignedRoles]);

  const departmentOptions = useMemo(
    () => departmentScopes.map((s) => ({
      value: String(s.scope_id),
      label: s.scope_label?.replace(/^Department:\s*/, '') || String(s.scope_id),
    })),
    [departmentScopes],
  );

  // Clear primaryDeptId if no longer in selected departments
  useEffect(() => {
    if (primaryDeptId && !departmentScopes.some((s) => String(s.scope_id) === primaryDeptId)) {
      setPrimaryDeptId('');
    }
  }, [departmentScopes, primaryDeptId]);

  const isInviteFlow = !setPasswordManually && departmentScopes.length > 0;

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
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (!currentOrganisationId) newErrors.organisation = 'Active organisation is required';
    if (setPasswordManually && !form.password.trim()) {
      newErrors.password = 'Password is required';
    }
    if (!setPasswordManually && departmentScopes.length === 0) {
      newErrors.scopes = 'Select at least one department to invite by email, or enable "Set password manually"';
    }
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

      const department_ids = departmentScopes.map((s) => Number(s.scope_id));

      await userService.createUser({
        email: form.email,
        password: (setPasswordManually && form.password.trim()) ? form.password.trim() : undefined,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        scope_type: 'ORGANISATION',
        scope_id: currentOrganisationId,
        profile: {
          job_title: form.job_title || undefined,
          employee_id: form.employee_id || undefined,
        },
        role_category_id: form.role_category_id ? Number(form.role_category_id) : undefined,
        reports_to_user_id: reportsTo?.user_id || undefined,
        department_ids: department_ids.length > 0 ? department_ids : undefined,
        primary_department_id: primaryDeptId ? Number(primaryDeptId) : undefined,
        chat_blocked_user_ids: chatBlockedIds.length > 0 ? chatBlockedIds : undefined,
        initial_roles: finalRoles.length > 0
          ? finalRoles.map((a) => ({ role_id: a.role_id, scope_type: a.scope_type, scope_id: a.scope_id }))
          : undefined,
        initial_permissions: finalPermissions.length > 0
          ? finalPermissions.map((p) => ({ module_action_id: p.module_action_id, scope_type: p.scope_type, scope_id: p.scope_id }))
          : undefined,
      });
      addToast(isInviteFlow ? `Invitation sent to ${form.email}` : 'User created successfully', 'success');
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
      <PageHeader title="Create User" subtitle="Add a new user account or invite an employee." backTo="/users" />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 space-y-6">

          {/* ── Identity ── */}
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="first_name" required value={form.first_name}
              error={errors.first_name} onChange={handleChange} />
            <Input label="Last Name" name="last_name" required value={form.last_name}
              error={errors.last_name} onChange={handleChange} />
          </div>
          <Input label="Email" name="email" type="email" required value={form.email}
            error={errors.email} onChange={handleChange} />
          <div className="grid grid-cols-2 gap-4 items-start">
            <div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none mb-2">
                <input
                  type="checkbox"
                  checked={setPasswordManually}
                  onChange={(e) => {
                    setSetPasswordManually(e.target.checked);
                    if (!e.target.checked) setForm((f) => ({ ...f, password: '' }));
                  }}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                Set password manually
              </label>
              {setPasswordManually
                ? <Input name="password" type="password" value={form.password}
                    error={errors.password} onChange={handleChange} required />
                : <p className="text-xs text-gray-400">Leave unchecked — an invitation email will be sent instead.</p>
              }
            </div>
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
          </div>
          {isInviteFlow && (
            <div className="rounded-lg bg-primary-50 border border-primary-100 px-4 py-3 flex items-center gap-3">
              <svg className="w-4 h-4 text-primary-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
              </svg>
              <p className="text-xs text-primary-800">
                Invitation will be sent to <strong>{form.email || 'this address'}</strong>. The user sets their own password via the link.
              </p>
            </div>
          )}

          {/* ── Profile ── */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <Select label="Job Title" name="job_title" value={form.job_title}
                onChange={handleChange} options={jobTitleOptions} placeholder="Select a job title" />
              <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Select label="Role Category" name="role_category_id" value={form.role_category_id}
                onChange={handleChange} options={roleCategoryOptions} placeholder="Select a category" />
              <ReportsToPicker label="Reporting To" value={reportsTo} onChange={setReportsTo}
                helpText="Search by name or email." />
            </div>
          </div>

          {/* ── Roles & Organisation ── */}
          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">Roles &amp; Organisation</h3>
            <p className="text-xs text-gray-500 mb-4">
              Assign the Employee role at department level to create org memberships and control content access.
            </p>
            {errors.scopes && (
              <p className="mb-3 text-xs text-red-600">{errors.scopes}</p>
            )}

            {assignedRoles.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignedRoles.map((a, i) => (
                  <div key={i}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${
                      previewRoleIndex === i ? 'border-primary-200 bg-primary-50/50' : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setPreviewRoleIndex(previewRoleIndex === i ? null : i)}>
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-gray-900">{a.role_name}</span>
                      {a.is_system && <span className="ml-2 text-xs text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-full">System</span>}
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{formatScopeLabel(a.scope_label, a.scope_type, a.scope_id)}</div>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <span className="text-xs text-gray-400">{previewRoleIndex === i ? 'Hide' : 'Permissions'}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveRole(i); }}
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
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Permissions — {assignedRoles[previewRoleIndex].role_name}
                    </p>
                    <PermissionMatrix modules={modules} selectedPermissions={previewPermissions} disabled />
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end gap-3">
              <Select label="Add Role" name="role" value={pickerRoleId}
                onChange={(e) => setPickerRoleId(e.target.value)}
                options={roleOptions} placeholder="Select a role…" className="flex-1" />
              <Button variant="secondary" size="md" onClick={handleAddRole} disabled={!pickerRoleId}>Add</Button>
            </div>

            {pickerRoleId && (
              <div className="mt-3 space-y-3">
                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">Scope this role to one or more org nodes:</p>
                  <HierarchyScopeSelector value={pickerScopes} onChange={setPickerScopes} />
                </div>
                {pickerRole && modules.length > 0 && (
                  <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/30">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Permissions — {pickerRole.name}
                    </p>
                    <PermissionMatrix modules={modules} selectedPermissions={pickerPermissions} disabled />
                  </div>
                )}
              </div>
            )}

            {departmentOptions.length > 1 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <Select label="Primary Department" name="primary_department" value={primaryDeptId}
                  onChange={(e) => setPrimaryDeptId(e.target.value)}
                  options={departmentOptions} placeholder="First selected (default)"
                  helpText="Which department to use as primary when the user belongs to more than one." />
              </div>
            )}
          </div>

          {/* ── Advanced (collapsed) ── */}
          <div className="border-t border-gray-100 pt-5">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="w-full flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors"
            >
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${showAdvanced ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
              Advanced
              <span className="ml-1 text-xs font-normal text-gray-400">
                Extra Permissions · Chat Access
                {(extraPerms.length > 0 || chatBlockedIds.length > 0) && (
                  <span className="ml-2 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-[10px] font-semibold">
                    {extraPerms.length + (chatBlockedIds.length > 0 ? 1 : 0)}
                  </span>
                )}
              </span>
            </button>

            {showAdvanced && (
              <div className="mt-5 space-y-6">
                {/* Extra Permissions */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800">Extra Permissions</h4>
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
                          options={moduleOptions} placeholder="Select module…" />
                        <Select label="Action" name="perm_action" value={permActionId}
                          onChange={(e) => setPermActionId(e.target.value)}
                          options={actionOptions}
                          placeholder={permModuleId ? 'Select action…' : 'Select module first'}
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
                        <div key={i} className="flex items-center justify-between px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{p.action_label}</div>
                            <div className="text-xs text-gray-500">{p.module_name} · {formatScopeLabel(p.scope_label, p.scope_type, p.scope_id)}</div>
                          </div>
                          <button type="button" onClick={() => handleRemovePerm(i)}
                            className="ml-3 p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors flex-shrink-0">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Chat Access */}
                <div className="border-t border-gray-100 pt-5">
                  <h4 className="text-sm font-semibold text-gray-800 mb-1">Chat Access</h4>
                  <p className="text-xs text-gray-500 mb-3">
                    Uncheck anyone this user should not be able to find in chat — the block is bidirectional.
                  </p>
                  <ChatAccessSelector candidates={chatCandidates} value={chatBlockedIds}
                    onChange={setChatBlockedIds} loading={chatCandidatesLoading} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <Button variant="secondary" onClick={() => navigate('/users')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>{isInviteFlow ? 'Send Invitation' : 'Create User'}</Button>
        </div>
      </div>
    </div>
  );
}
