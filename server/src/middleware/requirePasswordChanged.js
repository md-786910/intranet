'use strict';

const ApiError = require('../utils/ApiError');

/**
 * After authenticate: block API use until must_change_password is cleared.
 * Allowlisted paths remain usable so the user can change password / logout / read me.
 */
const ALLOWED_PREFIXES = [
  '/api/v1/auth/change-password',
  '/api/v1/auth/logout',
  '/api/v1/auth/me',
];

function requirePasswordChanged(req, res, next) {
  if (!req.user?.must_change_password) {
    return next();
  }

  const url = (req.originalUrl || req.url || '').split('?')[0];
  if (ALLOWED_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`))) {
    return next();
  }

  return next(
    ApiError.forbidden('Password change required', [
      { code: 'MUST_CHANGE_PASSWORD' },
    ]),
  );
}

module.exports = requirePasswordChanged;
