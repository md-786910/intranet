const router = require('express').Router();
const controller = require('./analytics.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const ApiError = require('../../utils/ApiError');
const schemas = require('./analytics.validation');

router.use(authenticate);

/** NEWS:VIEW or DOCUMENTS:VIEW — Content Manager workspace (not Owner analytics). */
async function authorizeContentWorkspace(req, res, next) {
  try {
    const permissionService = require('../../services/permission.service');
    const userId = req.user.user_id;
    const [canNews, canDocs] = await Promise.all([
      permissionService.hasPermissionAnywhere(userId, 'NEWS', 'VIEW'),
      permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'VIEW'),
    ]);
    if (!canNews && !canDocs) {
      throw ApiError.forbidden('Insufficient permission: NEWS:VIEW or DOCUMENTS:VIEW');
    }
    req.contentWorkspaceAccess = { news: canNews, documents: canDocs };
    return next();
  } catch (err) {
    return next(err);
  }
}

router.get('/dashboard', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.dashboardSchema), controller.dashboard);
router.get('/content', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.content);
router.get('/users', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.users);
router.get('/push', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.push);
router.get(
  '/content-workspace',
  authorizeContentWorkspace,
  validate(schemas.contentWorkspaceSchema),
  controller.contentWorkspace,
);

module.exports = router;
