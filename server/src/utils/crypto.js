const crypto = require('crypto');

/**
 * Generate a SHA-256 hash of a string.
 * Used for hashing refresh tokens before storage.
 */
const sha256 = (value) => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

/**
 * Generate a cryptographically secure random hex string.
 * @param {number} bytes - Number of random bytes (default 64)
 * @returns {string} Hex-encoded random string
 */
const generateToken = (bytes = 64) => {
  return crypto.randomBytes(bytes).toString('hex');
};

module.exports = { sha256, generateToken };
