const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

const required = ['DB_PASSWORD', 'REDIS_PASSWORD', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];
const missing = required.filter((key) => !process.env[key]);

if (missing.length) {
  console.error(`[env] Missing required variables: ${missing.join(', ')}`);
  process.exit(1);
}

// Email (SMTP) config is optional — when absent, invitation links are logged instead.
const smtpConfigured = Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
if (!smtpConfigured) {
  console.warn('[env] SMTP not configured — invitation emails will be logged to server console only.');
}

if (!process.env.APP_BASE_URL) {
  console.warn('[env] APP_BASE_URL not set — defaulting to http://localhost:3000');
}
