import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Textarea from '../../components/common/Textarea';
import Badge from '../../components/common/Badge';
import PermissionMatrix from '../../components/roles/PermissionMatrix';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { roleService } from '../../services/roleService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';
import { useCurrentOrganisation } from '../../hooks/useCurrentOrganisation';

export default function RoleEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const { currentOrganisationId } = useCurrentOrganisation();
  const [modules, setModules] = useState([]);
  const [role, setRole] = useState(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [selectedPermissions, setSelectedPermissions] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (!currentOrganisationId) return;
    Promise.all([
      roleService.getRole(id, { scope_type: 'ORGANISATION', scope_id: currentOrganisationId }),
      roleService.getModules({ scope_type: 'ORGANISATION', scope_id: currentOrganisationId }),
    ]).then(([roleRes, modulesRes]) => {
      const r = roleRes.data?.data;
      setRole(r);
      setForm({ name: r.name, description: r.description || '' });
      const perms = new Set(r.permissions?.map(p => p.module_action_id) || []);
      setSelectedPermissions(perms);
      setModules(modulesRes.data?.data || []);
    }).catch(() => addToast('Failed to load role', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast, currentOrganisationId]);

  const handleClone = () => {
    navigate('/roles/create', { state: { cloneFrom: role } });
  };

  const handleSave = async () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Role name is required';
    if (selectedPermissions.size === 0) newErrors.permissions = 'Select at least one permission';
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    setErrors({});
    try {
      const permissions = [...selectedPermissions].map(mid => ({ module_action_id: mid, effect: 'ALLOW' }));
      await roleService.updateRole(id, {
        name: form.name,
        description: form.description,
        scope_type: 'ORGANISATION', scope_id: currentOrganisationId,
        permissions,
      });
      addToast('Role updated successfully', 'success');
      navigate('/roles');
    } catch (err) {
      const message = getErrorMessage(err, 'Failed to update role');
      addToast(message, 'error');
      
      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setErrors(prev => ({ ...prev, ...validationErrors }));
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await roleService.deleteRole(id);
      addToast('Role deleted', 'success');
      navigate('/roles');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to delete role', 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse h-10 bg-gray-100 rounded w-48" />
        <div className="animate-pulse h-64 bg-gray-100 rounded-xl" />
        <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!role) return <div className="text-center py-12 text-gray-500">Role not found</div>;

  const isSystem = role.is_system;

  // ── System Role: Read-only detail view ──
  if (isSystem) {
    return (
      <div>
        <PageHeader
          title={role.name}
          subtitle="This is a system role and cannot be modified."
          backTo="/roles"
          actions={
            <div className="flex items-center gap-3">
              <Badge variant="info" size="md">System Role</Badge>
              <Button variant="secondary" size="sm" onClick={handleClone}>Clone as Custom Role</Button>
            </div>
          }
        />

        {/* Role info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Role Details</h2>
          <dl className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <dt className="text-gray-500">Name</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{role.name}</dd>
            </div>
            <div>
              <dt className="text-gray-500">Code</dt>
              <dd className="mt-0.5"><code className="text-xs bg-gray-100 px-2 py-0.5 rounded">{role.code}</code></dd>
            </div>
            <div>
              <dt className="text-gray-500">Created</dt>
              <dd className="font-medium text-gray-900 mt-0.5">{formatDate(role.created_at) || 'System default'}</dd>
            </div>
            {role.description && (
              <div className="md:col-span-3">
                <dt className="text-gray-500">Description</dt>
                <dd className="font-medium text-gray-900 mt-0.5">{role.description}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Permissions (read-only) */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-1">
            Permissions
          </h2>
          <p className="text-xs text-gray-500 mb-4">
            {selectedPermissions.size} permissions assigned. System role permissions cannot be changed.
          </p>
          <PermissionMatrix
            modules={modules}
            selectedPermissions={selectedPermissions}
            onChange={() => {}}
            disabled
          />
        </div>
      </div>
    );
  }

  // ── Custom Role: Editable form ──
  return (
    <div>
      <PageHeader
        title={`Edit: ${role.name}`}
        subtitle="Update this role's details and permissions."
        backTo="/roles"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={handleClone}>Clone</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Delete Role</Button>
          </div>
        }
      />

      {/* Role Details */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">Role Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Role Name"
            name="name"
            required
            value={form.name}
            error={errors.name}
            onChange={(e) => {
              setForm(prev => ({ ...prev, name: e.target.value }));
              if (errors.name) setErrors(prev => ({ ...prev, name: null }));
            }}
          />
          <Input
            label="Role Code"
            name="code"
            value={role.code}
            disabled
            helpText="Role codes cannot be changed after creation."
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
        <div className="mt-3 text-xs text-gray-400">
          Created {formatDate(role.created_at)}
        </div>
      </div>

      {/* Permissions */}
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

      {/* Footer Actions */}
      <div className="flex justify-end gap-3 mt-6">
        <Button variant="secondary" onClick={() => navigate('/roles')}>Cancel</Button>
        <Button onClick={handleSave} loading={saving}>Save Changes</Button>
      </div>

      <ConfirmDialog
        isOpen={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Delete Role"
        message={`Permanently delete "${role.name}"? Users currently assigned this role will lose these permissions immediately.`}
      />
    </div>
  );
}
