// Azure AD (Microsoft Entra ID) SSO configuration.
// SSO is optional — when AZURE_TENANT_ID is unset, isEnabled() returns false
// and the Azure auth routes respond 503 with a friendly message.
//
// AZURE_REDIRECT_URIS is a comma-separated allowlist. Each entry must (a) be
// registered as a Web redirect URI on the Azure app registration and (b) match
// a frontend's AzureReturnPage URL. The frontend tells the backend which URI
// it wants to use; the backend validates against this list and forwards the
// same value to Microsoft for both authorize() and acquireTokenByCode().

const tenantId = (process.env.AZURE_TENANT_ID || '').trim();
const clientId = (process.env.AZURE_CLIENT_ID || '').trim();
const clientSecret = process.env.AZURE_CLIENT_SECRET || '';

const redirectUris = (process.env.AZURE_REDIRECT_URIS || process.env.AZURE_REDIRECT_URI || '')
  .split(',')
  .map((u) => u.trim())
  .filter(Boolean);

const enabled = Boolean(tenantId && clientId && clientSecret && redirectUris.length);

function isAllowedRedirectUri(uri) {
  return Boolean(uri) && redirectUris.includes(uri);
}

module.exports = Object.freeze({
  enabled,
  tenantId,
  clientId,
  clientSecret,
  redirectUris,
  defaultRedirectUri: redirectUris[0] || '',
  isAllowedRedirectUri,
  authority: tenantId ? `https://login.microsoftonline.com/${tenantId}` : '',
  scopes: ['openid', 'profile', 'email', 'User.Read'],
});
