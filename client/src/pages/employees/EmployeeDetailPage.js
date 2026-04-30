import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchEmployee = useCallback(() => {
    setLoading(true);
    employeeService.getEmployee(id)
      .then((res) => setEmployee(res.data?.data))
      .catch(() => addToast('Failed to load employee', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchEmployee(); }, [fetchEmployee]);

  const handleResend = async () => {
    setResending(true);
    try {
      await employeeService.resendInvite(id);
      addToast('Invitation resent', 'success');
      fetchEmployee();
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to resend invitation', 'error');
    } finally {
      setResending(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await employeeService.deleteEmployee(id);
      addToast('Employee removed', 'success');
      navigate('/employees');
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to remove employee', 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!employee) return <div className="text-center py-12 text-gray-500">Employee not found</div>;

  return (
    <div>
      <PageHeader
        title={`${employee.first_name} ${employee.last_name}`}
        subtitle={employee.email}
        backTo="/employees"
        actions={
          <div className="flex gap-2">
            {employee.status === 'INVITED' && (
              <Button variant="secondary" size="sm" onClick={handleResend} loading={resending}>
                Resend Invitation
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => navigate(`/employees/${id}/edit`)}>Edit</Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteOpen(true)}>Remove</Button>
          </div>
        }
      />

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Profile</h3>
          <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Status</dt><dd className="mt-1"><StatusBadge status={employee.status} /></dd></div>
            <div><dt className="text-gray-500">Phone</dt><dd className="mt-1 font-medium">{employee.phone || '—'}</dd></div>
            <div><dt className="text-gray-500">Job Title</dt><dd className="mt-1 font-medium">{employee.profile?.job_title || '—'}</dd></div>
            <div><dt className="text-gray-500">Employee ID</dt><dd className="mt-1 font-medium">{employee.profile?.employee_id || '—'}</dd></div>
            <div><dt className="text-gray-500">Created</dt><dd className="mt-1 font-medium">{formatDate(employee.created_at)}</dd></div>
            {employee.invitation_pending && (
              <div>
                <dt className="text-gray-500">Invitation expires</dt>
                <dd className="mt-1 font-medium">{formatDate(employee.invitation_expires_at)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Organisation Assignments ({employee.departmentMemberships?.length || 0})
          </h3>
          {(!employee.departmentMemberships || employee.departmentMemberships.length === 0) ? (
            <p className="text-sm text-gray-500">No department memberships</p>
          ) : (
            <div className="space-y-2">
              {employee.departmentMemberships.map((membership) => (
                <div key={membership.membership_id || membership.department_id}
                     className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{membership.department?.name}</div>
                    <div className="text-xs text-gray-500">{membership.path}</div>
                  </div>
                  {membership.is_primary && <Badge variant="success" size="sm">Primary</Badge>}
                </div>
              ))}
            </div>
          )}
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Roles ({employee.roleAssignments?.length || 0})
          </h3>
          {(!employee.roleAssignments || employee.roleAssignments.length === 0) ? (
            <p className="text-sm text-gray-500">No roles assigned</p>
          ) : (
            <div className="space-y-2">
              {employee.roleAssignments.map((assignment) => (
                <div key={assignment.assignment_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="font-medium text-gray-900">{assignment.role?.name}</div>
                    <div className="text-xs text-gray-500">
                      {assignment.scope_type.replace(/_/g, ' ')} #{assignment.scope_id}
                    </div>
                  </div>
                  {assignment.role?.is_system && <Badge variant="info" size="sm">System</Badge>}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={handleDelete}
        loading={deleting} title="Remove Employee"
        message={`Remove "${employee.first_name} ${employee.last_name}"? They will lose access immediately.`} />
    </div>
  );
}
