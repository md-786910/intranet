const router = require('express').Router();
const controller = require('./roles.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./roles.validation');

router.use(authenticate);

// GET /api/v1/roles/modules — must be before /:id
router.get(
  '/modules',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.getModulesSchema),
  controller.listModules
);

// GET /api/v1/roles
router.get(
  '/',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.listRolesSchema),
  controller.list
);

// GET /api/v1/roles/:id
router.get(
  '/:id',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.idParam),
  controller.getById
);

// POST /api/v1/roles
router.post(
  '/',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.createRoleSchema),
  auditLogger('ROLE_CREATED'),
  controller.create
);

// PUT /api/v1/roles/:id
router.put(
  '/:id',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.updateRoleSchema),
  auditLogger('ROLE_UPDATED'),
  controller.update
);

// DELETE /api/v1/roles/:id
router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGE_ROLES'),
  auditLogger('ROLE_DELETED'),
  controller.remove
);

// POST /api/v1/roles/:id/clone
router.post(
  '/:id/clone',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.cloneRoleSchema),
  auditLogger('ROLE_CREATED'),
  controller.clone
);

module.exports = router;
