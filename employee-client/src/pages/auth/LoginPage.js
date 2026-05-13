import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import AuthShell from '../../components/layout/AuthShell';
import MicrosoftSignInButton from '../../features/auth-azure/MicrosoftSignInButton';
import { extractValidationErrors, getErrorMessage } from '../../utils/errorUtils';

const AZURE_SSO_ENABLED = process.env.REACT_APP_AZURE_SSO_ENABLED === 'true';

const MailIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

const LockIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const ShieldIcon = (
  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/home';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Sign in failed. Please try again.'));
      const validationErrors = extractValidationErrors(err);
      if (Object.keys(validationErrors).length > 0) {
        setFieldErrors(validationErrors);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFieldChange = (setter, field) => (e) => {
    setter(e.target.value);
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  return (
    <AuthShell statusLine>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
        <h2 className="text-2xl font-semibold text-gray-900">Login</h2>
        <p className="mt-1 text-sm text-gray-500">Enter your credentials to continue</p>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
              {error}
            </div>
          )}

          <Input
            label="Corporate Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            error={fieldErrors.email}
            onChange={handleFieldChange(setEmail, 'email')}
            placeholder="name@company.com"
            leftIcon={MailIcon}
          />

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label
                htmlFor="password"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-500"
              >
                Password <span className="text-red-500 normal-case">*</span>
              </label>
              <Link
                to="/forgot-password"
                className="text-xs font-medium text-brand-600 hover:text-brand-700"
              >
                Forgot?
              </Link>
            </div>
            <Input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              error={fieldErrors.password}
              onChange={handleFieldChange(setPassword, 'password')}
              placeholder="••••••••"
              leftIcon={LockIcon}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-600 select-none cursor-pointer">
            <input
              type="checkbox"
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Keep me signed in
          </label>

          <Button
            type="submit"
            loading={isSubmitting}
            className="w-full py-3 bg-brand-300 hover:bg-brand-400 text-brand-900 font-semibold"
          >
            Continue to Workspace
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Button>

          {AZURE_SSO_ENABLED && (
            <>
              <div className="relative my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-gray-500">or</span>
                </div>
              </div>
              <MicrosoftSignInButton />
            </>
          )}

          <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500">
            {ShieldIcon}
            <span>Encrypted, secure corporate session active</span>
          </div>
        </form>
      </div>
    </AuthShell>
  );
}
