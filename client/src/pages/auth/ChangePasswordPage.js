import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { useAuth } from '../../hooks/useAuth';
import api from '../../config/api';
import { validatePassword } from '../../utils/passwordValidation';
import { getErrorMessage } from '../../utils/errorUtils';

export default function ChangePasswordPage() {
  const { user, logout, setUser } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const pwdError = validatePassword(newPassword);
    if (pwdError) {
      setError(pwdError);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      await api.put('/auth/change-password', { currentPassword, newPassword });
      if (user) {
        setUser({ ...user, must_change_password: false });
      }
      await logout();
      navigate('/login', {
        replace: true,
        state: { notice: 'Password updated. Please sign in with your new password.' },
      });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
        <h2 className="text-2xl font-semibold text-gray-900">Change password</h2>
        <p className="mt-1 text-sm text-gray-500">
          For security, you must set a new password before continuing.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Input
            label="Current password"
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
          <Input
            label="New password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            helpText="At least 8 characters with upper, lower, digit, and special character."
          />
          <Input
            label="Confirm new password"
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          <Button type="submit" className="w-full" loading={submitting}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
