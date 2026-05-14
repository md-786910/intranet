const router = require('express').Router();
const controller = require('./employees.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./employees.validation');

router.use(authenticate);

router.get(
  '/',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.listEmployeesSchema),
  controller.list,
);

// Pool of active users for the "Chat access" selector on Create/Edit Employee.
// Declared before `/:id` so the literal path wins over the param route.
router.get(
  '/chat-candidates',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  controller.listChatCandidates,
);

router.get(
  '/:id',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.idParam),
  controller.getById,
);

router.post(
  '/',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.createEmployeeSchema),
  auditLogger('EMPLOYEE_CREATED'),
  controller.create,
);

router.put(
  '/:id',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.updateEmployeeSchema),
  auditLogger('EMPLOYEE_UPDATED'),
  controller.update,
);

router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.idParam),
  auditLogger('EMPLOYEE_DEACTIVATED'),
  controller.softDelete,
);

router.post(
  '/:id/resend-invite',
  authorize('ADMIN', 'MANAGE_EMPLOYEES'),
  validate(schemas.idParam),
  auditLogger('EMPLOYEE_INVITE_RESENT'),
  controller.resendInvite,
);

module.exports = router;
