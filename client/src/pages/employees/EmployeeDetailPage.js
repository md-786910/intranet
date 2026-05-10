import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';

function initials(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase();
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children}</dd>
    </div>
  );
}

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

  // Build a quick lookup so role assignments can show real department names
  // instead of "DEPARTMENT #12".
  const departmentNameById = useMemo(() => {
    const map = new Map();
    (employee?.departmentMemberships || []).forEach((m) => {
      const dept = m.department;
      if (dept?.id) map.set(Number(dept.id), dept.name);
    });
    return map;
  }, [employee]);

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

  const roleCategoryName = employee.profile?.roleCategory?.name;
  const manager = employee.profile?.manager;

  return (
    <div>
      <PageHeader
        title="Employee"
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

      {/* Identity card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xl font-semibold shrink-0">
            {initials(employee.first_name, employee.last_name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-gray-900 truncate">
                {employee.first_name} {employee.last_name}
              </h2>
              <StatusBadge status={employee.status} />
              {roleCategoryName && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium border border-primary-100">
                  {roleCategoryName}
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-gray-500">{employee.email}</div>
            {employee.profile?.job_title && (
              <div className="mt-1 text-sm text-gray-700">{employee.profile.job_title}</div>
            )}
            {employee.invitation_pending && (
              <div className="mt-3 text-xs inline-flex items-center gap-2 px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
                Invitation pending — expires {formatDate(employee.invitation_expires_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Profile + Hierarchy */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Profile</h3>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Phone">{employee.phone || <span className="text-gray-400">—</span>}</Field>
            <Field label="Employee ID">{employee.profile?.employee_id || <span className="text-gray-400">—</span>}</Field>
            <Field label="Job Title">{employee.profile?.job_title || <span className="text-gray-400">—</span>}</Field>
            <Field label="Created">{formatDate(employee.created_at)}</Field>
          </dl>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Hierarchy</h3>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Role Category">
              {roleCategoryName ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary-50 text-primary-700 text-xs font-medium border border-primary-100">
                  {roleCategoryName}
                </span>
              ) : <span className="text-gray-400">—</span>}
            </Field>
            <Field label="Reporting To">
              {manager ? (
                <Link to={`/employees/${manager.user_id}`} className="text-primary-700 hover:underline font-medium">
                  {manager.first_name} {manager.last_name}
                </Link>
              ) : <span className="text-gray-400">—</span>}
            </Field>
          </dl>
        </section>
      </div>

      {/* Organisation Assignments */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Organisation Assignments</h3>
          <span className="text-xs text-gray-500">{employee.departmentMemberships?.length || 0} total</span>
        </div>
        {(!employee.departmentMemberships || employee.departmentMemberships.length === 0) ? (
          <p className="text-sm text-gray-500">No department memberships.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employee.departmentMemberships.map((membership) => (
              <div
                key={membership.membership_id || membership.department_id}
                className={`flex items-start justify-between gap-3 p-3 rounded-lg border ${
                  membership.is_primary
                    ? 'bg-emerald-50/40 border-emerald-100'
                    : 'bg-gray-50 border-gray-100'
                }`}
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{membership.department?.name}</div>
                  <div className="text-xs text-gray-500 truncate">{membership.path}</div>
                </div>
                {membership.is_primary && <Badge variant="success" size="sm">Primary</Badge>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Roles */}
      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-700">Roles</h3>
          <span className="text-xs text-gray-500">{employee.roleAssignments?.length || 0} total</span>
        </div>
        {(!employee.roleAssignments || employee.roleAssignments.length === 0) ? (
          <p className="text-sm text-gray-500">No roles assigned.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employee.roleAssignments.map((assignment) => {
              const scopeLabel = assignment.scope_type === 'DEPARTMENT'
                && departmentNameById.get(Number(assignment.scope_id))
                  ? departmentNameById.get(Number(assignment.scope_id))
                  : `${assignment.scope_type.replace(/_/g, ' ')} #${assignment.scope_id}`;
              return (
                <div
                  key={assignment.assignment_id}
                  className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900 truncate">{assignment.role?.name}</div>
                    <div className="text-xs text-gray-500 truncate">
                      <span className="uppercase tracking-wide text-[10px] text-gray-400 mr-1">
                        {assignment.scope_type.replace(/_/g, ' ').toLowerCase()}
                      </span>
                      {scopeLabel}
                    </div>
                  </div>
                  {assignment.role?.is_system && <Badge variant="info" size="sm">System</Badge>}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={handleDelete}
        loading={deleting} title="Remove Employee"
        message={`Remove "${employee.first_name} ${employee.last_name}"? They will lose access immediately.`} />
    </div>
  );
}
