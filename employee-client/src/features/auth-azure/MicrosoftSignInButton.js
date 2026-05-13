import React, { useState } from 'react';
import { fetchAzureLoginUrl } from './azureApi';
import { getErrorMessage } from '../../utils/errorUtils';

const MicrosoftLogo = () => (
  <svg className="h-4 w-4" viewBox="0 0 23 23" xmlns="http://www.w3.org/2000/svg">
    <rect x="1" y="1" width="10" height="10" fill="#F25022" />
    <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
    <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
    <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
  </svg>
);

export default function MicrosoftSignInButton() {
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState('');

  const handleClick = async () => {
    setError('');
    setIsRedirecting(true);
    try {
      const url = await fetchAzureLoginUrl();
      window.location.assign(url);
    } catch (err) {
      setIsRedirecting(false);
      setError(getErrorMessage(err, 'Microsoft sign-in is unavailable right now.'));
    }
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRedirecting}
        className="w-full py-3 flex items-center justify-center gap-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-60"
      >
        <MicrosoftLogo />
        {isRedirecting ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft'}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
