const router = require('express').Router();
const controller = require('./users.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./users.validation');

router.use(authenticate);

// POST /api/v1/users/import — must be before /:id
router.post(
  '/import',
  authorize('ADMIN', 'MANAGE_USERS'),
  auditLogger('USER_BULK_IMPORT'),
  controller.importCsv
);

// GET /api/v1/users/chat-candidates — must be before /:id
router.get(
  '/chat-candidates',
  authorize('ADMIN', 'MANAGE_USERS'),
  controller.listChatCandidates
);

// GET /api/v1/users
router.get(
  '/',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.listUsersSchema),
  controller.list
);

// GET /api/v1/users/:id/org-chain — must be before /:id catch-all
router.get(
  '/:id/org-chain',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.idParam),
  controller.getOrgChain
);

// GET /api/v1/users/:id
router.get(
  '/:id',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.idParam),
  controller.getById
);

// POST /api/v1/users
router.post(
  '/',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.createUserSchema),
  auditLogger('USER_CREATED'),
  controller.create
);

// PUT /api/v1/users/:id
router.put(
  '/:id',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.updateUserSchema),
  auditLogger('USER_UPDATED'),
  controller.update
);

// DELETE /api/v1/users/:id  — deactivate (status=INACTIVE, access revoked)
router.delete(
  '/:id',
  authorize('ADMIN', 'MANAGE_USERS'),
  auditLogger('USER_DEACTIVATED'),
  controller.deactivate
);

// POST /api/v1/users/:id/reactivate
router.post(
  '/:id/reactivate',
  authorize('ADMIN', 'MANAGE_USERS'),
  auditLogger('USER_REACTIVATED'),
  controller.reactivate
);

// DELETE /api/v1/users/:id/permanent  — hard delete (sets deleted_at, hidden forever)
router.delete(
  '/:id/permanent',
  authorize('ADMIN', 'MANAGE_USERS'),
  auditLogger('USER_PERMANENTLY_DELETED'),
  controller.permanentDelete
);

// POST /api/v1/users/:id/roles
router.post(
  '/:id/roles',
  authorize('ADMIN', 'MANAGE_ROLES'),
  validate(schemas.assignRoleSchema),
  auditLogger('ROLE_ASSIGNED'),
  controller.assignRole
);

// DELETE /api/v1/users/:id/roles/:assignmentId
router.delete(
  '/:id/roles/:assignmentId',
  authorize('ADMIN', 'MANAGE_ROLES'),
  auditLogger('ROLE_UNASSIGNED'),
  controller.unassignRole
);

// POST /api/v1/users/:id/permissions
router.post(
  '/:id/permissions',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.assignPermissionSchema),
  auditLogger('PERMISSION_ASSIGNED'),
  controller.assignDirectPermission
);

// DELETE /api/v1/users/:id/permissions/:permissionId
router.delete(
  '/:id/permissions/:permissionId',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.removePermissionParam),
  auditLogger('PERMISSION_REMOVED'),
  controller.removeDirectPermission
);

// POST /api/v1/users/:id/departments
router.post(
  '/:id/departments',
  authorize('ADMIN', 'MANAGE_DEPARTMENTS'),
  validate(schemas.assignDepartmentSchema),
  controller.assignDepartment
);

// DELETE /api/v1/users/:id/departments/:deptId
router.delete(
  '/:id/departments/:deptId',
  authorize('ADMIN', 'MANAGE_DEPARTMENTS'),
  controller.removeDepartment
);

// POST /api/v1/users/:id/resend-invite
router.post(
  '/:id/resend-invite',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(schemas.idParam),
  auditLogger('USER_INVITE_RESENT'),
  controller.resendInvite
);

module.exports = router;
