import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Badge from '../../components/common/Badge';
import StatusBadge from '../../components/common/StatusBadge';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import { employeeService } from '../../services/employeeService';
import { useToast } from '../../hooks/useToast';
import { formatDate } from '../../utils/formatters';
import ChatDrawer from '../../components/chat/ChatDrawer';
import NotFoundState from '../../components/common/NotFoundState';
import { getErrorMessage, getUserFacingMessage, isNotFoundError } from '../../utils/errorUtils';

function mediaUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const apiBase = (process.env.REACT_APP_API_URL || 'http://localhost:8000/api/v1').replace(/\/api\/v1\/?$/, '');
  return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
}

function initials(first, last) {
  return `${(first || '').charAt(0)}${(last || '').charAt(0)}`.toUpperCase() || '?';
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{children || <span className="text-gray-400">—</span>}</dd>
    </div>
  );
}

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [resending, setResending] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const fetchEmployee = useCallback(() => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);
    employeeService.getEmployee(id)
      .then((res) => setEmployee(res.data?.data))
      .catch((err) => {
        setEmployee(null);
        if (isNotFoundError(err)) {
          setNotFound(true);
          return;
        }
        setLoadError(true);
        if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to load employee'), 'error');
      })
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
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to resend invitation'), 'error');
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
      if (!err?.isHandled) addToast(getUserFacingMessage(err, 'Failed to remove employee'), 'error');
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (notFound) {
    return (
      <NotFoundState
        pageTitle="Employee"
        title="Employee not found"
        description="This employee does not exist or is no longer available."
        backTo="/employees"
        backLabel="Back to employees"
      />
    );
  }
  if (loadError || !employee) {
    return (
      <NotFoundState
        pageTitle="Employee"
        title="Unable to load employee"
        description="Something went wrong while loading this employee."
        backTo="/employees"
        backLabel="Back to employees"
      />
    );
  }

  const displayName = [employee.first_name, employee.last_name].filter(Boolean).join(' ');
  const manager = employee.profile?.manager;
  const avatarSrc = mediaUrl(employee.avatar_url);
  const jobDeptLine = [employee.profile?.job_title, employee.profile?.department_display]
    .filter(Boolean)
    .join(' · ');
  const company = employee.profile?.companyNode?.name || employee.profile?.company_name;
  const office = employee.profile?.officeNode?.name || employee.profile?.location;

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

      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-start gap-5">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={displayName}
              className="w-16 h-16 rounded-full object-cover shrink-0 border border-gray-100"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-primary-50 text-primary-700 flex items-center justify-center text-xl font-semibold shrink-0">
              {initials(employee.first_name, employee.last_name)}
            </div>
          )}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-semibold text-gray-900 truncate">{displayName}</h2>
              <StatusBadge status={employee.status} />
            </div>
            {jobDeptLine && <p className="text-sm text-gray-600">{jobDeptLine}</p>}
            <p className="text-sm text-gray-500">{employee.email}</p>
            <div className="flex flex-wrap gap-2 pt-2">
              {employee.email && (
                <a
                  href={`mailto:${employee.email}`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                >
                  Email
                </a>
              )}
              <button
                type="button"
                onClick={() => setChatOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Chat
              </button>
            </div>
            {employee.invitation_pending && (
              <div className="mt-2 text-xs inline-flex items-center gap-2 px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-100">
                Invitation pending — expires {formatDate(employee.invitation_expires_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Profile</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Job Title">{employee.profile?.job_title}</Field>
          <Field label="Department">{employee.profile?.department_display}</Field>
          <Field label="Company">{company}</Field>
          <Field label="Email">{employee.email}</Field>
          <Field label="Phone">{employee.phone}</Field>
          <Field label="Mobile">{employee.mobile_phone}</Field>
          <Field label="Office Location">{office}</Field>
          <Field label="Manager">
            {manager ? (
              <Link to={`/employees/${manager.user_id}`} className="text-primary-700 hover:underline font-medium">
                {manager.first_name} {manager.last_name}
              </Link>
            ) : null}
          </Field>
        </dl>
      </section>

      {(employee.roleAssignments?.length > 0) && (
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-baseline justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Roles</h3>
            <span className="text-xs text-gray-500">{employee.roleAssignments.length} total</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {employee.roleAssignments.map((assignment) => (
              <div
                key={assignment.assignment_id}
                className="flex items-start justify-between gap-3 p-3 bg-gray-50 border border-gray-100 rounded-lg"
              >
                <div className="min-w-0">
                  <div className="font-medium text-gray-900 truncate">{assignment.role?.name}</div>
                  <div className="text-xs text-gray-500 truncate uppercase tracking-wide">
                    {assignment.scope_type?.replace(/_/g, ' ').toLowerCase()}
                  </div>
                </div>
                {assignment.role?.is_system && <Badge variant="info" size="sm">System</Badge>}
              </div>
            ))}
          </div>
        </section>
      )}

      <ConfirmDialog isOpen={deleteOpen} onCancel={() => setDeleteOpen(false)} onConfirm={handleDelete}
        loading={deleting} title="Remove Employee"
        message={`Remove "${employee.first_name} ${employee.last_name}"? They will lose access immediately.`} />

      <ChatDrawer
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        userId={employee.user_id || id}
        displayName={displayName}
        jobTitle={employee.profile?.job_title}
        avatarUrl={employee.avatar_url}
      />
    </div>
  );
}
