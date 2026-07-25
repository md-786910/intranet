'use strict';

const router = require('express').Router();
const controller = require('./azure-ad.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { syncUsersSchema, syncLocalUserSchema } = require('./azure-ad.validation');

// All Azure AD routes require a session.
router.use(authenticate);

const requireManageUsers = authorize('ADMIN', 'MANAGE_USERS');

// ── Org chart (any authenticated user; response redacted without Manage Users) ─
router.get('/users/:id/direct-reports/count', controller.getUserDirectReportsCount);
router.get('/users/:id/direct-reports', controller.getUserDirectReports);
router.get('/org-tree/roots', controller.getOrgTreeRoots);

// ── Directory PII + sync (Manage Users only) ──────────────────────────────────
router.get('/test-connection', requireManageUsers, controller.testConnection);
router.get('/departments', requireManageUsers, controller.getDepartments);
router.get('/users', requireManageUsers, controller.listUsers);
router.get('/users/:id', requireManageUsers, controller.getUser);

router.post(
  '/sync-users',
  requireManageUsers,
  validate(syncUsersSchema),
  controller.syncUsers,
);

router.post(
  '/sync-local-user/:userId',
  requireManageUsers,
  validate(syncLocalUserSchema),
  controller.syncLocalUser,
);

router.delete('/cache', requireManageUsers, controller.clearCache);

module.exports = router;
