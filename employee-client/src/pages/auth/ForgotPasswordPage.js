import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import AuthShell from '../../components/layout/AuthShell';
import { getErrorMessage } from '../../utils/errorUtils';

const MailIcon = (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.6} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
  </svg>
);

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      await authService.forgotPassword(email);
      setSubmitted(true);
    } catch (err) {
      setError(getErrorMessage(err, 'Could not send reset link. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthShell>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
        {submitted ? (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">Check your email</h2>
            <p className="mt-2 text-sm text-gray-600">
              If an account exists for <strong>{email}</strong>, we've sent a link to reset
              the password. The link expires in 30 minutes.
            </p>
            <Link
              to="/login"
              className="mt-6 inline-flex items-center text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              ← Back to sign in
            </Link>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-semibold text-gray-900">Forgot password</h2>
            <p className="mt-1 text-sm text-gray-500">
              Enter your corporate email and we'll send a reset link.
            </p>

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
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                leftIcon={MailIcon}
              />

              <Button
                type="submit"
                loading={isSubmitting}
                className="w-full py-3 bg-brand-300 hover:bg-brand-400 text-brand-900 font-semibold"
              >
                Send reset link
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  ← Back to sign in
                </Link>
              </div>
            </form>
          </>
        )}
      </div>
    </AuthShell>
  );
}
