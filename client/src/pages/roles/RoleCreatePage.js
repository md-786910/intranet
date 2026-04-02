import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Badge from '../../components/common/Badge';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

function generateCode(name) {
  return name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
}

export default function RoleCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const cloneFrom = location.state?.cloneFrom || null;

  const [modules, setModules] = useState([]);
  const [form, setForm] = useState({
    name: cloneFrom ? `Copy of ${cloneFrom.name}` : '',
    code: cloneFrom ? `${cloneFrom.code}_COPY` : '',
    description: cloneFrom?.description || '',
  });
  const [codeManual, setCodeManual] = useState(!!cloneFrom);
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!currentOrganisationId) return;
    roleService.getModules({ scope_type: 'ORGANISATION', scope_id: currentOrganisationId })
      .then((res) => {
        const mods = res.data?.data || [];
        setModules(mods);

        // Pre-fill permissions if cloning
        if (cloneFrom?.permissions) {
          const perms = new Set(cloneFrom.permissions.map(p => p.module_action_id));
          setSelectedPermissions(perms);
        }
      })
      .catch(() => addToast('Failed to load modules', 'error'));
  }, [addToast, cloneFrom, currentOrganisationId]);

  const handleNameChange = (e) => {
    const name = e.target.value;
    setForm(prev => ({
      ...prev,
      name,
      code: codeManual ? prev.code : generateCode(name),
    }));
    if (errors.name) setErrors(prev => ({ ...prev, name: null }));
  };

  const handleCodeChange = (e) => {
    setCodeManual(true);
    setForm(prev => ({ ...prev, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') }));
    if (errors.code) setErrors(prev => ({ ...prev, code: null }));
  };

  const validate = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Role name is required';
    if (!form.code.trim()) newErrors.code = 'Role code is required';
    else if (!/^[A-Z][A-Z0-9_]*$/.test(form.code)) newErrors.code = 'Must start with a letter, only A-Z, 0-9, _';
    if (selectedPermissions.size === 0) newErrors.permissions = 'Select at least one permission';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!currentOrganisationId) {
      addToast('No active organisation available', 'error');
      return;
    }
    setSaving(true);
    try {
      const permissions = [...selectedPermissions].map(id => ({ module_action_id: id, effect: 'ALLOW' }));
      await roleService.createRole({
        name: form.name,
        code: form.code,
        description: form.description,
        scope_type: 'ORGANISATION', scope_id: currentOrganisationId,
        permissions,
      });
      addToast('Role created successfully', 'success');
      navigate('/roles');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to create role');
      addToast(message, 'error');
      
      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...validationErrors }));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* Back link */}
      <Link to="/roles" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Roles
      </Link>

      <PageHeader
        title="Create New Role"
        subtitle="Define a role and assign permissions."
        actions={cloneFrom && <Badge variant="info" size="md">Cloned from: {cloneFrom.name}</Badge>}
      />

      {/* ── Section 1: Role Details ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Role Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Role Name"
            name="name"
            required
            value={form.name}
            error={errors.name}
            placeholder="e.g. Content Reviewer"
            onChange={handleNameChange}
          />
          <Input
            label="Role Code"
            name="code"
            required
            value={form.code}
            error={errors.code}
            placeholder="e.g. CONTENT_REVIEWER"
            helpText="Auto-generated from name. Uppercase letters, numbers, and underscores only."
            onChange={handleCodeChange}
          />
        </div>
        <div className="mt-4">
          <Textarea
            label="Description"
            name="description"
            value={form.description}
            rows={2}
            placeholder="Briefly describe what this role is for..."
            onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
          />
        </div>
      </div>

      {/* ── Section 2: Permissions ── */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Assign Permissions</h2>
          <p className="text-xs text-gray-500 mt-1">
            Select what this role can do. Click "Select all" to toggle an entire module.
          </p>
        </div>

        {errors.permissions && (
          <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {errors.permissions}
          </div>
        )}

        <PermissionMatrix
          modules={modules}
          selectedPermissions={selectedPermissions}
          onChange={(perms) => {
            setSelectedPermissions(perms);
            if (errors.permissions) setErrors(prev => ({ ...prev, permissions: null }));
          }}
        />
      </div>

      {/* ── Footer Actions ── */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => navigate('/roles')}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Create Role</Button>
      </div>
    </div>
  );
}
