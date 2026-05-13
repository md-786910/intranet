import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { completeAzureLogin } from './azureApi';
import { getErrorMessage } from '../../utils/errorUtils';

export default function AzureReturnPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setAuthFromTokens } = useAuth();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const code = params.get('code');
    const state = params.get('state');
    const azureError = params.get('error_description') || params.get('error');

    if (azureError) {
      setError(decodeURIComponent(azureError));
      return;
    }
    if (!code || !state) {
      setError('Microsoft sign-in did not return the expected parameters.');
      return;
    }

    (async () => {
      try {
        const session = await completeAzureLogin(code, state);
        await setAuthFromTokens(session.accessToken, session.refreshToken, session.user, session.permissions);
        navigate('/home', { replace: true });
      } catch (err) {
        setError(getErrorMessage(err, 'Microsoft sign-in failed. Please try again.'));
      }
    })();
  }, [params, navigate, setAuthFromTokens]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="max-w-md w-full text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">
          {error ? 'Sign-in failed' : 'Signing you in…'}
        </h1>
        {error ? (
          <>
            <p className="text-sm text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => navigate('/login', { replace: true })}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Back to login
            </button>
          </>
        ) : (
          <p className="text-sm text-gray-600">Verifying your Microsoft account…</p>
        )}
      </div>
    </div>
  );
}
