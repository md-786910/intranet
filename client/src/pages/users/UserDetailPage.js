import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import StatusBadge from '../../components/common/StatusBadge';
import Badge from '../../components/common/Badge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { userService } from '../../services/userService';
import { useToast } from '../../hooks/useToast';
import { formatDate, formatNodeType } from '../../utils/formatters';

export default function UserDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('profile');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const params = { org_unit_id: 1 };
    userService.getUser(id, params)
      .then((res) => setUser(res.data?.data))
      .catch(() => addToast('Failed to load user', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

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
          {tab === 'profile' && (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div><dt className="text-gray-500">Status</dt><dd className="mt-1"><StatusBadge status={user.status} /></dd></div>
              <div><dt className="text-gray-500">Phone</dt><dd className="mt-1 font-medium">{user.phone || '—'}</dd></div>
              <div><dt className="text-gray-500">Job Title</dt><dd className="mt-1 font-medium">{user.profile?.job_title || '—'}</dd></div>
              <div><dt className="text-gray-500">Employee ID</dt><dd className="mt-1 font-medium">{user.profile?.employee_id || '—'}</dd></div>
              <div><dt className="text-gray-500">Created</dt><dd className="mt-1 font-medium">{formatDate(user.created_at)}</dd></div>
            </dl>
          )}

          {tab === 'roles' && (
            <div className="space-y-3">
              {user.roleAssignments?.length === 0 ? (
                <p className="text-sm text-gray-500">No role assignments</p>
              ) : (
                user.roleAssignments.map((a) => (
                  <div key={a.assignment_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-medium text-gray-900">{a.role?.name}</div>
                      <div className="text-xs text-gray-500">
                        Scope: {a.orgUnit?.name} ({formatNodeType(a.orgUnit?.node_type)})
                      </div>
                    </div>
                    {a.role?.is_system && <Badge variant="info" size="sm">System</Badge>}
                  </div>
                ))
              )}
            </div>
          )}

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
