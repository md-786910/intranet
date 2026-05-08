import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { useAuth } from '../../hooks/useAuth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Spinner from '../../components/common/Spinner';
import AuthShell from '../../components/layout/AuthShell';
import { validatePassword } from '../../utils/passwordValidation';
import { getErrorMessage } from '../../utils/errorUtils';

const LockIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

export default function InvitationAcceptPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const { setAuthFromTokens } = useAuth();

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState('');
  const [invite, setInvite] = useState(null);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    authService
      .validateInvitation(token)
      .then((res) => {
        if (cancelled) return;
        setInvite(res.data.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenError(getErrorMessage(err, 'This invitation link is invalid or has expired.'));
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
      const res = await authService.acceptInvitation(token, password);
      const { accessToken, refreshToken, user, permissions } = res.data.data;
      await setAuthFromTokens(accessToken, refreshToken, user, permissions);
      navigate('/workspace', { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Could not activate your account. Please try again.'));
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
            <p className="text-sm text-gray-500">Validating invitation…</p>
          </div>
        ) : tokenError ? (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">Invitation invalid</h2>
            <p className="mt-2 text-sm text-gray-600">{tokenError}</p>
            <p className="mt-4 text-sm text-gray-500">
              Please contact your administrator to request a new invitation.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">
              Welcome{invite?.first_name ? `, ${invite.first_name}` : ''}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Activate your account by setting a password for <strong>{invite?.email}</strong>.
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
                className="w-full py-3 bg-primary-300 hover:bg-primary-400 text-primary-900 font-semibold"
              >
                Activate account
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
