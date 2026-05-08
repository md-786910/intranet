const router = require('express').Router();
const controller = require('./org.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./org.validation');

// All routes require authentication
router.use(authenticate);

// ── Read routes (no authorize — filtered by user context) ──

router.get('/tree', controller.getTree);

router.get('/my-vertical', controller.getMyVertical);

router.get('/:id', validate(schemas.idParam), controller.getById);

router.get('/:id/children', validate(schemas.idParam), controller.getChildren);

router.get('/:id/subtree', validate(schemas.idParam), controller.getSubtree);

// ── Office Locations ──

router.post(
  '/office-locations',
  authorize('ADMIN', 'MANAGE_OFFICE_LOCATIONS'),
  validate(schemas.createOfficeLocationSchema),
  auditLogger('ORG_UNIT_CREATED'),
  controller.createOfficeLocation
);

router.put(
  '/office-locations/:id',
  authorize('ADMIN', 'MANAGE_OFFICE_LOCATIONS'),
  validate(schemas.updateOfficeLocationSchema),
  auditLogger('ORG_UNIT_UPDATED'),
  controller.updateOfficeLocation
);

router.delete(
  '/office-locations/:id',
  authorize('ADMIN', 'MANAGE_OFFICE_LOCATIONS'),
  auditLogger('ORG_UNIT_DELETED'),
  controller.deleteOfficeLocation
);

// ── Verticals ──

router.post(
  '/verticals',
  authorize('ADMIN', 'MANAGE_VERTICALS'),
  validate(schemas.createVerticalSchema),
  auditLogger('ORG_UNIT_CREATED'),
  controller.createVertical
);

router.put(
  '/verticals/:id',
  authorize('ADMIN', 'MANAGE_VERTICALS'),
  validate(schemas.updateVerticalSchema),
  auditLogger('ORG_UNIT_UPDATED'),
  controller.updateVertical
);

router.delete(
  '/verticals/:id',
  authorize('ADMIN', 'MANAGE_VERTICALS'),
  auditLogger('ORG_UNIT_DELETED'),
  controller.deleteVertical
);

// ── Departments ──

router.post(
  '/departments',
  authorize('ADMIN', 'MANAGE_DEPARTMENTS'),
  validate(schemas.createDepartmentSchema),
  auditLogger('ORG_UNIT_CREATED'),
  controller.createDepartment
);

router.put(
  '/departments/:id',
  authorize('ADMIN', 'MANAGE_DEPARTMENTS'),
  validate(schemas.updateDepartmentSchema),
  auditLogger('ORG_UNIT_UPDATED'),
  controller.updateDepartment
);

router.delete(
  '/departments/:id',
  authorize('ADMIN', 'MANAGE_DEPARTMENTS'),
  auditLogger('ORG_UNIT_DELETED'),
  controller.deleteDepartment
);

module.exports = router;
