import api from '../../config/api';

// Each frontend uses its own origin so the Microsoft redirect comes back to
// the right SPA. The backend validates this against an allowlist.
export const AZURE_RETURN_URL = `${window.location.origin}/auth/azure/return`;

export async function fetchAzureStatus() {
  const res = await api.get('/auth/azure/status');
  return res.data.data;
}

export async function fetchAzureLoginUrl() {
  const res = await api.get('/auth/azure/login', {
    params: { redirect_uri: AZURE_RETURN_URL, audience: 'employee' },
  });
  return res.data.data.url;
}

export async function completeAzureLogin(code, state) {
  const res = await api.post('/auth/azure/callback', { code, state });
  return res.data.data;
}
