const router = require('express').Router();
const controller = require('./role-categories.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const schemas = require('./role-categories.validation');

router.use(authenticate);

router.get(
  '/',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  controller.list,
);

router.post(
  '/',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.createSchema),
  controller.create,
);

router.put(
  '/reorder',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.reorderSchema),
  controller.reorder,
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
