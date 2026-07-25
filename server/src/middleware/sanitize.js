const { JSDOM } = require('jsdom');
const createDOMPurify = require('dompurify');

const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

// Path/field tuples that legitimately carry rich HTML and should bypass the
// global tag-stripping. Each route is responsible for sanitising the field
// itself with a narrower whitelist (see server/src/utils/sanitiseRichText.js).
const RICH_TEXT_EXEMPTIONS = [
  { method: 'POST', pathRegex: /^\/api\/v1\/news\/?$/, fields: ['body'] },
  { method: 'PUT', pathRegex: /^\/api\/v1\/news\/\d+\/?$/, fields: ['body'] },
  { method: 'POST', pathRegex: /^\/api\/v1\/documents\/?$/, fields: ['summary'] },
  { method: 'POST', pathRegex: /^\/api\/v1\/documents\/(publish-now|schedule-now)\/?$/, fields: ['summary'] },
  { method: 'PUT', pathRegex: /^\/api\/v1\/documents\/\d+\/?$/, fields: ['summary'] },
];

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    return DOMPurify.sanitize(value, { ALLOWED_TAGS: [] }).trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    sanitized[key] = sanitizeValue(value);
  }
  return sanitized;
};

const sanitizeBodyWithExemptions = (obj, exemptFields) => {
  const sanitized = {};
  for (const [key, value] of Object.entries(obj)) {
    if (exemptFields.includes(key)) {
      // Pass through unchanged — the route must run sanitiseRichText() on it.
      sanitized[key] = value;
    } else {
      sanitized[key] = sanitizeValue(value);
    }
  }
  return sanitized;
};

const findExemption = (req) => RICH_TEXT_EXEMPTIONS.find(
  (rule) => rule.method === req.method && rule.pathRegex.test(req.path),
);

const sanitize = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    const exemption = findExemption(req);
    req.body = exemption
      ? sanitizeBodyWithExemptions(req.body, exemption.fields)
      : sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
};

module.exports = sanitize;
