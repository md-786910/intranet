const router = require('express').Router();
const controller = require('./quick-links.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schemas = require('./quick-links.validation');

router.use(authenticate);

// Anyone authenticated may read — Quick Links are surfaced on the employee home.
router.get('/', controller.list);

// Mutations are gated to ADMIN:MANAGE_EMPLOYEES, which both Owner and Office
// Manager already hold (see seeders/003-seed-default-roles.js). No new
// permission / role is added for this feature.
router.post(
  '/',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.createSchema),
  controller.create,
);

router.put(
  '/:id',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.updateSchema),
  controller.update,
);

router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.idParam),
  controller.remove,
);

module.exports = router;
