// Thin Microsoft Graph client. Only the `/me` endpoint is used today (profile
// sync at sign-in). All requests are best-effort — Graph failures must never
// block authentication, so callers should treat a null return as "skip sync".

const logger = require('../../../config/logger');

const GRAPH_ME_URL =
  'https://graph.microsoft.com/v1.0/me?$select=' +
  ['givenName', 'surname', 'displayName', 'jobTitle', 'department', 'officeLocation', 'mobilePhone', 'businessPhones'].join(',');

async function fetchMe(accessToken) {
  if (!accessToken) return null;

  try {
    const res = await fetch(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      logger.warn(`[azure-graph] /me returned ${res.status}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    logger.warn(`[azure-graph] /me request failed: ${err.message}`);
    return null;
  }
}

module.exports = { fetchMe };
