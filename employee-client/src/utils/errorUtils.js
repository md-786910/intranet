/**
 * API error helpers aligned with backend shape:
 * { status: 'fail'|'error', message, errors?: [{ field, message, source? }] }
 */

const NETWORK_MESSAGE = 'Unable to reach the server. Check your connection and try again.';
const SERVER_MESSAGE = 'Something went wrong on our side. Please try again.';
const FORBIDDEN_MESSAGE = "You don't have permission to do that.";
const RATE_LIMIT_MESSAGE = 'Too many requests. Please wait a moment and try again.';
const CONFLICT_MESSAGE = 'This change conflicts with existing data.';
const DEFAULT_MESSAGE = 'An unexpected error occurred';

const TECHNICAL_PATTERNS = [
  /^network error$/i,
  /^timeout of \d+/i,
  /^request failed with status code/i,
  /^failed to fetch$/i,
  /ECONNREFUSED/i,
  /ETIMEDOUT/i,
];

export const extractValidationErrors = (err) => {
  const validationErrors = {};
  const errors = err?.normalized?.errors || err?.response?.data?.errors;

  if (Array.isArray(errors)) {
    errors.forEach((error) => {
      if (error?.field && !validationErrors[error.field]) {
        validationErrors[error.field] = error.message;
      }
    });
  }

  return validationErrors;
};

const isTechnicalMessage = (msg) => {
  if (!msg || typeof msg !== 'string') return true;
  return TECHNICAL_PATTERNS.some((re) => re.test(msg.trim()));
};

export const isNotFoundError = (err) => {
  const status = err?.normalized?.status ?? err?.response?.status;
  return status === 404;
};

export const getHttpStatus = (err) =>
  err?.normalized?.status ?? err?.response?.status ?? null;

export const normalizeApiError = (err) => {
  if (err?.normalized) return err.normalized;

  const status = err?.response?.status ?? null;
  const data = err?.response?.data;
  const errors = Array.isArray(data?.errors) ? data.errors : [];
  const rawMessage = (typeof data?.message === 'string' && data.message.trim())
    ? data.message.trim()
    : (typeof err?.message === 'string' ? err.message : '');

  const isNetwork = !err?.response && Boolean(err?.request || err?.message);
  const isValidation = status === 400 && errors.length > 0;
  const isNotFound = status === 404;
  const isForbidden = status === 403;
  const isConflict = status === 409;
  const isRateLimited = status === 429;
  const isUnauthorized = status === 401;
  const isServerError = typeof status === 'number' && status >= 500;

  let message = rawMessage;
  if (isNetwork || (!status && isTechnicalMessage(rawMessage))) {
    message = NETWORK_MESSAGE;
  } else if (isServerError) {
    message = (rawMessage && !isTechnicalMessage(rawMessage) && data?.status === 'fail')
      ? rawMessage
      : SERVER_MESSAGE;
  } else if (isForbidden && (!rawMessage || isTechnicalMessage(rawMessage))) {
    message = FORBIDDEN_MESSAGE;
  } else if (isRateLimited && (!rawMessage || isTechnicalMessage(rawMessage))) {
    message = RATE_LIMIT_MESSAGE;
  } else if (isConflict && (!rawMessage || isTechnicalMessage(rawMessage))) {
    message = CONFLICT_MESSAGE;
  } else if (!message || isTechnicalMessage(message)) {
    message = DEFAULT_MESSAGE;
  }

  const normalized = {
    status,
    message,
    errors,
    isValidation,
    isNotFound,
    isForbidden,
    isConflict,
    isRateLimited,
    isUnauthorized,
    isServerError,
    isNetwork,
    isHandled: Boolean(err?.isHandled),
  };

  if (err && typeof err === 'object') {
    err.normalized = normalized;
  }

  return normalized;
};

export const getUserFacingMessage = (err, fallback = DEFAULT_MESSAGE) => {
  const n = normalizeApiError(err);
  return n.message || fallback;
};

export const getErrorMessage = (err, fallback = DEFAULT_MESSAGE) =>
  getUserFacingMessage(err, fallback);

export const markErrorHandled = (err) => {
  if (err && typeof err === 'object') {
    err.isHandled = true;
    if (err.normalized) err.normalized.isHandled = true;
  }
  return err;
};

/**
 * Toast (or otherwise notify) only if the interceptor did not already handle it.
 * @returns {boolean} true if notify was called
 */
export const notifyUnlessHandled = (err, notify, fallback) => {
  if (err?.isHandled) return false;
  if (typeof notify !== 'function') return false;
  notify(getUserFacingMessage(err, fallback));
  return true;
};

export const applyGlobalApiErrorPolicy = (err, bridge) => {
  const config = err?.config || {};
  // Caller owns UX — do not toast globally and do not mark handled
  // (so the page can still toast / show EmptyState).
  if (config.silent || config.skipGlobalError) {
    return err;
  }

  const url = config.url || '';
  if (url.includes('/auth/login') || url.includes('/auth/refresh')) {
    return err;
  }

  const n = normalizeApiError(err);
  const toast = bridge?.error || bridge?.show;

  if (n.isNotFound) return err;
  if (n.isValidation) return err;
  if (n.isUnauthorized) return err;

  if (typeof toast !== 'function') return err;

  if (n.isForbidden) {
    toast(n.message || FORBIDDEN_MESSAGE);
    return markErrorHandled(err);
  }
  if (n.isConflict) {
    toast(n.message || CONFLICT_MESSAGE);
    return markErrorHandled(err);
  }
  if (n.isRateLimited) {
    toast(n.message || RATE_LIMIT_MESSAGE);
    return markErrorHandled(err);
  }
  if (n.isServerError || n.isNetwork) {
    toast(n.message);
    return markErrorHandled(err);
  }
  if (n.status === 400 || (n.status >= 400 && n.status < 500)) {
    toast(n.message);
    return markErrorHandled(err);
  }

  return err;
};
