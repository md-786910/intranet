const router = require('express').Router();
const validate = require('../../../middleware/validate');
const auditLogger = require('../../../middleware/auditLogger');
const { authLimiter } = require('../../../middleware/rateLimiter');
const controller = require('./azure.controller');
const schemas = require('./azure.validation');

// GET /api/v1/auth/azure/status — public, used by the login page to decide whether to render the button
router.get('/status', controller.getStatus);

// GET /api/v1/auth/azure/login — returns the Microsoft authorization URL
router.get('/login', authLimiter, controller.getAuthUrl);

// POST /api/v1/auth/azure/callback — exchanges the code for our app's JWT
router.post(
  '/callback',
  authLimiter,
  validate(schemas.callbackSchema),
  auditLogger('AZURE_LOGIN_ATTEMPT'),
  controller.handleCallback,
);

module.exports = router;
