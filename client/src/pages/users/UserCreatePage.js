import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import { userService } from '../../services/userService';
import { useToast } from '../../hooks/useToast';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const DEFAULT_ORG_UNIT_ID = 1;

export default function UserCreatePage() {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', phone: '',
    job_title: '', employee_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (errors[e.target.name]) setErrors({ ...errors, [e.target.name]: null });
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
        org_unit_id: DEFAULT_ORG_UNIT_ID,
        profile: {
          job_title: form.job_title || undefined,
          employee_id: form.employee_id || undefined,
        },
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

  return (
    <div>
      <PageHeader title="Create User" subtitle="Add a new user account" />
      <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-2xl">
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
          <hr className="my-4" />
          <h3 className="text-sm font-medium text-gray-700">Profile</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input label="Job Title" name="job_title" value={form.job_title} onChange={handleChange} />
            <Input label="Employee ID" name="employee_id" value={form.employee_id} onChange={handleChange} />
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-200">
          <Button variant="secondary" onClick={() => navigate('/users')}>Cancel</Button>
          <Button onClick={handleSave} loading={saving}>Create User</Button>
        </div>
      </div>
    </div>
  );
}
