import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Input from "../../components/common/Input";
import Button from "../../components/common/Button";
import api from "../../config/api";
import { validatePassword } from "../../utils/passwordValidation";
import { getErrorMessage } from "../../utils/errorUtils";

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [validating, setValidating] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [tokenInfo, setTokenInfo] = useState(null);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get(`/auth/password-resets/${token}/validate`, { silent: true })
      .then((res) => {
        if (cancelled) return;
        setTokenInfo(res.data?.data);
      })
      .catch((err) => {
        if (cancelled) return;
        setTokenError(
          getErrorMessage(err, "This reset link is invalid or expired."),
        );
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
    setError("");
    setFieldErrors({});

    const pwError = validatePassword(password);
    if (pwError) {
      setFieldErrors({ password: pwError });
      return;
    }
    if (password !== confirm) {
      setFieldErrors({ confirm: "Passwords do not match" });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post(
        `/auth/password-resets/${token}/reset`,
        { password },
        { silent: true },
      );
      navigate("/login", {
        replace: true,
        state: { notice: "Password updated. Please sign in with your new password." },
      });
    } catch (err) {
      setError(getErrorMessage(err, "Could not reset password. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-primary-800">BrightNow</h1>
          <p className="mt-2 text-sm text-gray-600">Admin Panel</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 px-8 py-8">
          {validating ? (
            <div className="py-8 flex flex-col items-center gap-3">
              <svg className="animate-spin h-6 w-6 text-primary-600" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <p className="text-sm text-gray-500">Validating reset link…</p>
            </div>
          ) : tokenError ? (
            <>
              <h2 className="text-2xl font-semibold text-gray-900">Link expired</h2>
              <p className="mt-2 text-sm text-gray-600">{tokenError}</p>
              <button
                type="button"
                onClick={() => navigate("/forgot-password")}
                className="mt-6 text-sm font-medium text-primary-600 hover:text-primary-500"
              >
                Request a new reset link →
              </button>
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
                />

                <Button type="submit" loading={isSubmitting} className="w-full">
                  Update password
                </Button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
