const router = require('express').Router();
const controller = require('./analytics.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schemas = require('./analytics.validation');

router.use(authenticate);

router.get('/dashboard', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.dashboardSchema), controller.dashboard);
router.get('/content', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.content);
router.get('/users', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.users);
router.get('/push', authorize('ADMIN', 'VIEW_ANALYTICS'), validate(schemas.analyticsQuerySchema), controller.push);

module.exports = router;
