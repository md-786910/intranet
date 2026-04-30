const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000/api/v1';

const ASSET_HOST = (() => {
  try {
    const u = new URL(API_URL, window.location.origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return '';
  }
})();

export function resolveAssetUrl(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith('/uploads')) return `${ASSET_HOST}${url}`;
  return url;
}
