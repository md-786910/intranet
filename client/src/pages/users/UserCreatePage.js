import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { userService } from '../../services/userService';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const DEFAULT_ORGANISATION_ID = 1;

const SCOPE_TYPE_OPTIONS = [
  { value: 'ORGANISATION', label: 'Organisation' },
  { value: 'OFFICE_LOCATION', label: 'Office Location' },
  { value: 'VERTICAL', label: 'Vertical' },
  { value: 'DEPARTMENT', label: 'Department' },
];

/**
 * Extract the Set of module_action_ids from a role's permissions array.
 * The roles API returns: role.permissions[].moduleAction.module_action_id
 */
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

  // ── Form state ──
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '',
    job_title: '', employee_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  // ── Role assignment state ──
  const [roles, setRoles] = useState([]);         // All available roles from API
  const [modules, setModules] = useState([]);      // All modules for permission matrix
  const [assignedRoles, setAssignedRoles] = useState([]); // Roles user is being assigned

  // Role picker form
  const [pickerRoleId, setPickerRoleId] = useState('');
  const [pickerScopeType, setPickerScopeType] = useState('ORGANISATION');
  const [pickerScopeId, setPickerScopeId] = useState(String(DEFAULT_ORGANISATION_ID));

  // Which assigned role's permissions are being previewed (index or null)
  const [previewIndex, setPreviewIndex] = useState(null);

  // ── Load roles and modules on mount ──
  useEffect(() => {
    roleService.getRoles({ limit: 100 })
      .then((res) => setRoles(res.data?.data?.roles || []))
      .catch(() => {});
    roleService.getModules()
      .then((res) => setModules(res.data?.data || []))
      .catch(() => {});
  }, []);

  // ── Derived: role options for the dropdown (exclude already assigned) ──
  const roleOptions = useMemo(() => {
    const assignedIds = new Set(assignedRoles.map((a) => a.role_id));
    return roles
      .filter((r) => !assignedIds.has(r.role_id))
      .map((r) => ({ value: String(r.role_id), label: `${r.name}${r.is_system ? ' (System)' : ''}` }));
  }, [roles, assignedRoles]);

  // ── Derived: permission set for the currently previewed role ──
  const previewPermissions = useMemo(() => {
    if (previewIndex === null || !assignedRoles[previewIndex]) return new Set();
    const role = roles.find((r) => r.role_id === assignedRoles[previewIndex].role_id);
    return extractPermissionIds(role);
  }, [previewIndex, assignedRoles, roles]);

  // ── Handlers ──
  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const handleAddRole = () => {
    if (!pickerRoleId) return;
    const roleId = Number(pickerRoleId);
    const role = roles.find((r) => r.role_id === roleId);
    if (!role) return;

    setAssignedRoles((prev) => [
      ...prev,
      {
        role_id: roleId,
        role_name: role.name,
        is_system: role.is_system,
        scope_type: pickerScopeType,
        scope_id: Number(pickerScopeId) || DEFAULT_ORGANISATION_ID,
      },
    ]);
    setPickerRoleId('');
    setPreviewIndex(assignedRoles.length); // Preview the newly added role
  };

  const handleRemoveRole = (index) => {
    setAssignedRoles((prev) => prev.filter((_, i) => i !== index));
    if (previewIndex === index) setPreviewIndex(null);
    else if (previewIndex !== null && previewIndex > index) setPreviewIndex(previewIndex - 1);
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.password) newErrors.password = 'Password is required';
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      await userService.createUser({
        email: form.email,
        password: form.password,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        scope_type: 'ORGANISATION',
        scope_id: DEFAULT_ORGANISATION_ID,
        profile: {
          job_title: form.job_title || undefined,
          employee_id: form.employee_id || undefined,
        },
        initial_roles: assignedRoles.length > 0
          ? assignedRoles.map((a) => ({
              role_id: a.role_id,
              scope_type: a.scope_type,
              scope_id: a.scope_id,
            }))
          : undefined,
      });
      addToast('User created successfully', 'success');
      navigate('/users');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create user');
      addToast(message, 'error');

      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(validationErrors);
      }
    } finally {
      setSaving(false);
    }
  };

  // Selected role in picker (for inline preview before adding)
  const pickerRole = pickerRoleId ? roles.find((r) => r.role_id === Number(pickerRoleId)) : null;
  const pickerPermissions = useMemo(() => extractPermissionIds(pickerRole), [pickerRole]);

  return (
    <div>
      <PageHeader title="Create User" subtitle="Add a new user account with role assignments" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: User Details ── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Account Info */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Account Information</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="First Name" name="first_name" required value={form.first_name}
                  error={errors.first_name} onChange={handleChange} />
                <Input label="Last Name" name="last_name" required value={form.last_name}
                  error={errors.last_name} onChange={handleChange} />
              </div>
              <Input label="Email" name="email" type="email" required value={form.email}
                error={errors.email} onChange={handleChange} />
              <Input label="Password" name="password" type="password" required value={form.password}
                error={errors.password} onChange={handleChange}
                helpText="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special" />
              <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            </div>
          </div>

          {/* Profile */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Job Title" name="job_title" value={form.job_title} onChange={handleChange} />
              <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
            </div>
          </div>

          {/* Role Assignment */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Role Assignment</h3>

            {/* Role picker */}
            <div className="flex items-end gap-3 mb-4">
              <Select
                label="Role"
                name="role"
                value={pickerRoleId}
                onChange={(e) => setPickerRoleId(e.target.value)}
                options={roleOptions}
                placeholder="Select a role..."
                className="flex-1"
              />
              <Select
                label="Scope"
                name="scope_type"
                value={pickerScopeType}
                onChange={(e) => setPickerScopeType(e.target.value)}
                options={SCOPE_TYPE_OPTIONS}
                className="w-44"
              />
              <Input
                label="Scope ID"
                name="scope_id"
                type="number"
                value={pickerScopeId}
                onChange={(e) => setPickerScopeId(e.target.value)}
                className="w-24"
              />
              <Button
                variant="secondary"
                size="md"
                onClick={handleAddRole}
                disabled={!pickerRoleId}
              >
                Add
              </Button>
            </div>

            {/* Assigned roles list */}
            {assignedRoles.length > 0 && (
              <div className="space-y-2 mb-4">
                {assignedRoles.map((a, index) => (
                  <div
                    key={index}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      previewIndex === index
                        ? 'border-primary-200 bg-primary-50/50'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setPreviewIndex(previewIndex === index ? null : index)}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{a.role_name}</div>
                        <div className="text-xs text-gray-500">
                          {a.scope_type.replace(/_/g, ' ')} #{a.scope_id}
                        </div>
                      </div>
                      {a.is_system && (
                        <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">System</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">
                        {previewIndex === index ? 'Hide permissions' : 'View permissions'}
                      </span>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRemoveRole(index); }}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Remove role"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Permission preview for assigned role */}
            {previewIndex !== null && assignedRoles[previewIndex] && modules.length > 0 && (
              <div className="border border-gray-200 rounded-lg p-4 bg-gray-50/50">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Permissions granted by {assignedRoles[previewIndex].role_name}
                </h4>
                <PermissionMatrix
                  modules={modules}
                  selectedPermissions={previewPermissions}
                  disabled
                />
              </div>
            )}

            {/* Inline preview when picking a role (before adding) */}
            {pickerRole && previewIndex === null && modules.length > 0 && (
              <div className="border border-dashed border-gray-300 rounded-lg p-4 bg-gray-50/30">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  Preview: Permissions in {pickerRole.name}
                </h4>
                <PermissionMatrix
                  modules={modules}
                  selectedPermissions={pickerPermissions}
                  disabled
                />
              </div>
            )}

            {assignedRoles.length === 0 && !pickerRole && (
              <p className="text-sm text-gray-400">No roles assigned yet. Select a role above to add.</p>
            )}
          </div>
        </div>

        {/* ── Right: Summary sidebar ── */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-xl border border-gray-200 p-6 sticky top-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4">Summary</h3>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-gray-500">Name</dt>
                <dd className="font-medium text-gray-900 mt-0.5">
                  {form.first_name || form.last_name
                    ? `${form.first_name} ${form.last_name}`.trim()
                    : '—'}
                </dd>
              </div>
              <div>
                <dt className="text-gray-500">Email</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{form.email || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Roles</dt>
                <dd className="mt-1">
                  {assignedRoles.length === 0 ? (
                    <span className="text-gray-400">None</span>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {assignedRoles.map((a, i) => (
                        <span key={i} className="text-xs font-medium text-primary-700 bg-primary-50 px-2 py-0.5 rounded-full">
                          {a.role_name}
                        </span>
                      ))}
                    </div>
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex flex-col gap-3 mt-6 pt-4 border-t border-gray-200">
              <Button onClick={handleSave} loading={saving} className="w-full">Create User</Button>
              <Button variant="secondary" onClick={() => navigate('/users')} className="w-full">Cancel</Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
