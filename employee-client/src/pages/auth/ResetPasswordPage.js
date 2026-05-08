import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import AuthShell from '../../components/layout/AuthShell';
import { useToast } from '../../hooks/useToast';
import { validatePassword } from '../../utils/passwordValidation';
import { getErrorMessage } from '../../utils/errorUtils';

const LockIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [tokenInfo, setTokenInfo] = useState(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService
      .validatePasswordReset(token)
      .then((res) => {
        if (cancelled) return;
        setTokenInfo(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenError(getErrorMessage(err, 'This reset link is invalid or expired.'));
      })
      .finally(() => {
        if (!cancelled) setValidating(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    const pwError = validatePassword(password);
    if (pwError) {
      setFieldErrors({ password: pwError });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: 'Passwords do not match' });
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(token, password);
      toast.success('Password updated. You can sign in now.');
      navigate('/login', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not reset password. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
        {validating ? (
          <div className="py-8 flex flex-col items-center gap-4">
            <Spinner />
            <p className="text-sm text-gray-500">Validating reset link…</p>
          </div>
        ) : tokenError ? (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">Link expired</h2>
            <p className="mt-2 text-sm text-gray-600">{tokenError}</p>
            <Link
              to="/forgot-password"
              className="mt-6 inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Request a new reset link →
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">Set a new password</h2>
            <p className="mt-1 text-sm text-gray-500">
              For <strong>{tokenInfo?.email}</strong>
            </p>

            <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <Input
                label="New Password"
                name="password"
                type="password"
                required
                value={password}
                error={fieldErrors.password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                leftIcon={LockIcon}
                helpText="At least 8 characters with uppercase, lowercase, digit, and special character."
              />

              <Input
                label="Confirm Password"
                name="confirm"
                type="password"
                required
                value={confirm}
                error={fieldErrors.confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                leftIcon={LockIcon}
              />

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full py-3 bg-brand-300 hover:bg-brand-400 text-brand-900 font-semibold"
              >
                Update password
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
