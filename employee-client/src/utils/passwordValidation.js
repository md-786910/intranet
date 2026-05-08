// Mirror server-side passwordPattern: 8-128 chars, 1 upper, 1 lower, 1 digit, 1 special
const SPECIAL_RE = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/;

export function validatePassword(password) {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (password.length > 128) {
    return 'Password is too long (max 128 characters)';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/\d/.test(password)) {
    return 'Password must contain at least one digit';
  }
  if (!SPECIAL_RE.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
}
