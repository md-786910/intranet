import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { employeeService } from '../../services/employeeService';
import { setTokens } from '../../config/api';
import { getErrorMessage } from '../../utils/errorUtils';

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,}$/;

export default function InvitationAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    employeeService.validateInvitation(token)
      .then((res) => setInvitation(res.data?.data))
      .catch((err) => {
        const status = err.response?.status;
        if (status === 410) setValidationError('This invitation link is invalid or has expired.');
        else setValidationError(getErrorMessage(err, 'Could not load invitation'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    const newErrors = {};
    if (!PASSWORD_PATTERN.test(password)) {
      newErrors.password = 'At least 8 characters with uppercase, lowercase, digit, and special character.';
    }
    if (password !== confirm) {
      newErrors.confirm = 'Passwords do not match';
    }
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    try {
      const res = await employeeService.acceptInvitation(token, password);
      const { accessToken, refreshToken } = res.data.data;
      setTokens(accessToken, refreshToken);
      // Hard reload so AuthProvider re-bootstraps with the new tokens
      window.location.href = '/';
    } catch (err) {
      setSubmitError(getErrorMessage(err, 'Could not activate your account'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-500 text-sm">Validating invitation...</div>
      </div>
    );
  }

  if (validationError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md w-full bg-white border border-gray-200 rounded-xl p-8 text-center">
          <h1 className="text-xl font-semibold text-gray-900">Invitation Unavailable</h1>
          <p className="mt-3 text-sm text-gray-600">{validationError}</p>
          <Button variant="secondary" className="mt-6" onClick={() => navigate('/login')}>Go to login</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-800">Brighthouse</h1>
          <p className="mt-2 text-sm text-gray-600">Activate your account</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900">
            Welcome{invitation?.first_name ? `, ${invitation.first_name}` : ''}!
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Set a password to activate your account for <strong>{invitation?.email}</strong>.
          </p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {submitError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {submitError}
              </div>
            )}
            <Input
              label="New Password" name="password" type="password" required
              value={password} error={errors.password}
              onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors({ ...errors, password: null }); }}
              helpText="At least 8 chars with uppercase, lowercase, digit, and special character."
            />
            <Input
              label="Confirm Password" name="confirm" type="password" required
              value={confirm} error={errors.confirm}
              onChange={(e) => { setConfirm(e.target.value); if (errors.confirm) setErrors({ ...errors, confirm: null }); }}
            />
            <Button type="submit" loading={submitting} className="w-full py-2.5">
              Activate account
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
