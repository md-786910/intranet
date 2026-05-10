import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import HierarchyScopeSelector from '../../components/common/HierarchyScopeSelector';
import ReportsToPicker from './ReportsToPicker';
import { employeeService } from '../../services/employeeService';
import { roleCategoryService } from '../../services/roleCategoryService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

export default function EmployeeCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();

  const [form, setForm] = useState({
    email: '', first_name: '', last_name: '', phone: '',
    job_title: '', employee_id: '',
    role_category_id: '',
  });
  const [reportsTo, setReportsTo] = useState(null);
  const [scopes, setScopes] = useState([]);
  const [primaryDeptId, setPrimaryDeptId] = useState('');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [roleCategories, setRoleCategories] = useState([]);

  useEffect(() => {
    roleCategoryService.list()
      .then((res) => setRoleCategories(res.data?.data || []))
      .catch((err) => addToast(getErrorMessage(err, 'Failed to load role categories'), 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roleCategoryOptions = useMemo(
    () => roleCategories.map((c) => ({ value: String(c.id), label: c.name })),
    [roleCategories],
  );

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

  const handleSave = async () => {
    const newErrors = {};
    if (!form.email) newErrors.email = 'Email is required';
    if (!form.first_name) newErrors.first_name = 'First name is required';
    if (!form.last_name) newErrors.last_name = 'Last name is required';
    if (!form.role_category_id) newErrors.role_category_id = 'Role category is required';
    if (departmentScopes.length === 0) {
      newErrors.scopes = 'Select at least one department (drill down to Department level in the picker below).';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSaving(true);
    try {
      const department_ids = departmentScopes.map((scope) => Number(scope.scope_id));
      const payload = {
        email: form.email,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone || undefined,
        job_title: form.job_title || undefined,
        employee_id: form.employee_id || undefined,
        role_category_id: Number(form.role_category_id),
        reports_to_user_id: reportsTo?.user_id || undefined,
        department_ids,
        primary_department_id: primaryDeptId ? Number(primaryDeptId) : department_ids[0],
      };
      await employeeService.createEmployee(payload);
      addToast(`Invitation email sent to ${form.email}`, 'success');
      navigate('/employees');
    } catch (err) {
      addToast(getErrorMessage(err, 'Failed to invite employee'), 'error');
      const ve = extractValidationErrors(err);
      if (Object.keys(ve).length > 0) setErrors(ve);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Invite Employee"
        subtitle="Create an account and email an invitation link to set their password."
        backTo="/employees"
      />

      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <Input label="First Name" name="first_name" required value={form.first_name}
              error={errors.first_name} onChange={handleChange} />
            <Input label="Last Name" name="last_name" required value={form.last_name}
              error={errors.last_name} onChange={handleChange} />
          </div>
          <Input label="Work Email" name="email" type="email" required value={form.email}
            error={errors.email} onChange={handleChange}
            helpText="The invitation link is sent to this address." />
          <Input label="Phone" name="phone" value={form.phone} onChange={handleChange} />

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
                required
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
                helpText="Search by name or email."
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-5">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Organisation Assignment <span className="text-red-500">*</span></h3>
            <p className="text-xs text-gray-500 mb-3">
              Drill down to one or more departments. The employee will see news and documents targeted at any of these
              departments (or their parent verticals/offices/organisation).
            </p>
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
            <div className="rounded-lg bg-primary-50/50 border border-primary-100 px-4 py-3">
              <p className="text-xs text-primary-900">
                New employees are assigned the <strong>Employee</strong> role at each selected department.
                They get read access to content (news, documents, directory) and can interact with it.
                To grant admin-level roles, use the <em>Users</em> section.
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50/50 rounded-b-xl">
          <Button variant="secondary" onClick={() => navigate('/employees')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Send Invitation</Button>
        </div>
      </div>
    </div>
  );
}
