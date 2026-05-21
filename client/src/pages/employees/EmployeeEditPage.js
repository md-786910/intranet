import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import ChatAccessSelector from '../../components/common/ChatAccessSelector';
import ReportsToPicker from './ReportsToPicker';
import { employeeService } from '../../services/employeeService';
import { roleCategoryService } from '../../services/roleCategoryService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
  { value: 'LOCKED', label: 'Locked' },
];

function buildScopesFromMemberships(memberships = []) {
  return memberships.map((membership) => {
    const department = membership.department;
    const verticalName = department?.vertical?.name;
    const officeName = department?.vertical?.officeLocation?.name;
    return {
      scope_type: 'DEPARTMENT',
      scope_id: department?.id || membership.department_id,
      scope_label: `Department: ${department?.name}${verticalName ? ` · ${verticalName}` : ''}${officeName ? ` · ${officeName}` : ''}`,
    };
  });
}

export default function EmployeeEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [employee, setEmployee] = useState(null);
  const [form, setForm] = useState({
    first_name: '', last_name: '', phone: '', status: 'ACTIVE',
    job_title: '', employee_id: '', role_category_id: '',
    date_of_joining: '', location: '', bio: '',
  });
  const [reportsTo, setReportsTo] = useState(null);
  const [roleCategories, setRoleCategories] = useState([]);
  const [scopes, setScopes] = useState([]);
  const [primaryDeptId, setPrimaryDeptId] = useState('');
  const [errors, setErrors] = useState({});
  const [chatCandidates, setChatCandidates] = useState([]);
  const [chatCandidatesLoading, setChatCandidatesLoading] = useState(true);
  const [chatBlockedIds, setChatBlockedIds] = useState([]);

  useEffect(() => {
    roleCategoryService.list()
      .then((res) => setRoleCategories(res.data?.data || []))
      .catch(() => addToast('Failed to load role categories', 'error'));
  }, [addToast]);

  useEffect(() => {
    employeeService.listChatCandidates()
      .then((res) => setChatCandidates(res.data?.data || []))
      .catch(() => setChatCandidates([]))
      .finally(() => setChatCandidatesLoading(false));
  }, []);

  const fetchEmployee = useCallback(() => {
    setLoading(true);
    employeeService.getEmployee(id)
      .then((res) => {
        const e = res.data?.data;
        setEmployee(e);
        setForm({
          first_name: e.first_name || '', last_name: e.last_name || '',
          phone: e.phone || '', status: e.status === 'INVITED' ? 'INVITED' : (e.status || 'ACTIVE'),
          job_title: e.profile?.job_title || '', employee_id: e.profile?.employee_id || '',
          role_category_id: e.profile?.role_category_id ? String(e.profile.role_category_id) : '',
          date_of_joining: e.profile?.date_of_joining ? e.profile.date_of_joining.slice(0, 10) : '',
          location: e.profile?.location || '',
          bio: e.profile?.bio || '',
        });
        if (e.profile?.manager) {
          setReportsTo({
            user_id: e.profile.manager.user_id,
            first_name: e.profile.manager.first_name,
            last_name: e.profile.manager.last_name,
            email: e.profile.manager.email,
          });
        } else {
          setReportsTo(null);
        }
        setScopes(buildScopesFromMemberships(e.departmentMemberships));
        const primary = (e.departmentMemberships || []).find((membership) => membership.is_primary);
        if (primary) setPrimaryDeptId(String(primary.department?.id || primary.department_id));
        setChatBlockedIds(Array.isArray(e.chat_blocked_user_ids) ? e.chat_blocked_user_ids : []);
      })
      .catch(() => addToast('Failed to load employee', 'error'))
      .finally(() => setLoading(false));
  }, [id, addToast]);

  useEffect(() => { fetchEmployee(); }, [fetchEmployee]);

  const roleCategoryOptions = useMemo(
    () => roleCategories.map((c) => ({ value: String(c.id), label: c.name })),
    [roleCategories],
  );

  const currentRoleCategoryRank = useMemo(() => {
    if (!form.role_category_id) return null;
    return roleCategories.find((c) => String(c.id) === form.role_category_id)?.rank || null;
  }, [form.role_category_id, roleCategories]);

  const departmentScopes = useMemo(
    () => scopes.filter((scope) => scope.scope_type === 'DEPARTMENT'),
    [scopes],
  );

  const departmentOptions = useMemo(
    () => departmentScopes.map((scope) => ({
      value: String(scope.scope_id),
      label: scope.scope_label.replace(/^Department:\s*/, ''),
    })),
    [departmentScopes],
  );

  useEffect(() => {
    if (!primaryDeptId) return;
    if (!departmentScopes.some((scope) => String(scope.scope_id) === primaryDeptId)) {
      setPrimaryDeptId('');
    }
  }, [departmentScopes, primaryDeptId]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
  };

  const statusOptions = useMemo(() => {
    if (employee?.status === 'INVITED') {
      return [{ value: 'INVITED', label: 'Invited (pending acceptance)' }, ...STATUS_OPTIONS];
    }
    return STATUS_OPTIONS;
  }, [employee?.status]);

  const handleSave = async () => {
    const newErrors = {};
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (departmentScopes.length === 0) {
      newErrors.scopes = 'Select at least one department.';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const department_ids = departmentScopes.map((scope) => Number(scope.scope_id));
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        job_title: form.job_title || undefined,
        employee_id: form.employee_id || undefined,
        role_category_id: form.role_category_id ? Number(form.role_category_id) : null,
        reports_to_user_id: reportsTo ? reportsTo.user_id : null,
        date_of_joining: form.date_of_joining || undefined,
        location: form.location || undefined,
        bio: form.bio || undefined,
        department_ids,
        primary_department_id: primaryDeptId ? Number(primaryDeptId) : department_ids[0],
        chat_blocked_user_ids: chatBlockedIds,
      };
      if (employee?.status !== 'INVITED' && form.status) payload.status = form.status;

      await employeeService.updateEmployee(id, payload);
      addToast('Employee updated', 'success');
      navigate(`/employees/${id}`);
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to update employee'), 'error');
      const ve = extractValidationErrors(err);
      if (Object.keys(ve).length > 0) setErrors(ve);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="animate-pulse h-96 bg-gray-100 rounded-xl" />;
  if (!employee) return <div className="text-center py-12 text-gray-500">Employee not found</div>;

  return (
    <div>
      <PageHeader title={`Edit: ${employee.first_name} ${employee.last_name}`} subtitle={employee.email} backTo={`/employees/${id}`} />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="first_name" required value={form.first_name}
              error={errors.first_name} onChange={handleChange} />
            <Input label="Last Name" name="last_name" required value={form.last_name}
              error={errors.last_name} onChange={handleChange} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />
            <Select label="Status" name="status" value={form.status}
              onChange={handleChange} options={statusOptions}
              disabled={employee.status === 'INVITED'} />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Profile</h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Job Title" name="job_title" value={form.job_title} onChange={handleChange} />
              <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Select
                label="Role Category"
                name="role_category_id"
                value={form.role_category_id}
                onChange={handleChange}
                options={roleCategoryOptions}
                placeholder="Select a category"
                error={errors.role_category_id}
              />
              <ReportsToPicker
                label="Reporting To"
                value={reportsTo}
                onChange={setReportsTo}
                excludeUserId={Number(id)}
                maxRoleRank={currentRoleCategoryRank}
                helpText="Search by name or email."
              />
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input label="Date of Joining" name="date_of_joining" type="date"
                value={form.date_of_joining} onChange={handleChange} />
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

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Organisation Assignment <span className="text-red-500">*</span></h3>
            <p className="text-xs text-gray-500 mb-3">Replace the employee's current department memberships.</p>
            <HierarchyScopeSelector value={scopes} onChange={setScopes} />
            {errors.scopes && <p className="mt-2 text-xs text-red-600">{errors.scopes}</p>}
            {departmentOptions.length > 1 && (
              <div className="mt-4">
                <Select label="Primary Department" name="primary_department"
                  value={primaryDeptId}
                  onChange={(e) => setPrimaryDeptId(e.target.value)}
                  options={departmentOptions}
                  placeholder="First selected (default)" />
              </div>
            )}
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Chat access</h3>
            <p className="text-xs text-gray-500 mb-3">
              All active colleagues are reachable by default. Uncheck anyone this employee should NOT be able to find in chat — the block is bidirectional.
            </p>
            <ChatAccessSelector
              candidates={chatCandidates}
              value={chatBlockedIds}
              onChange={setChatBlockedIds}
              loading={chatCandidatesLoading}
              excludeUserId={Number(id)}
            />
          </div>

          <div className="border-t border-gray-100 pt-5">
            <div className="rounded-lg bg-gray-50 border border-gray-200 px-4 py-3">
              <p className="text-xs text-gray-600">
                Role assignments are fixed to <strong>Employee</strong> at each selected department.
                To grant admin-level roles, use the <em>Users</em> section.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <Button variant="secondary" onClick={() => navigate(`/employees/${id}`)}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Save Changes</Button>
        </div>
      </div>
    </div>
  );
}
