const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1";

// Extract the base URL (e.g. http://localhost:8000) from the API_URL
const getBaseUrl = () => {
  try {
    const url = new URL(API_URL);
    return `${url.protocol}//${url.host}`;
  } catch (e) {
    return 'http://localhost:8000';
  }
};

const BASE_URL = getBaseUrl();

/**
 * Resolves a media URL from the backend.
 * If the URL is already absolute (starts with http), it returns it as is.
 * Otherwise, it prepends the backend base URL.
 */
export const resolveMediaUrl = (path) => {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // Ensure path starts with a slash
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${normalizedPath}`;
};
