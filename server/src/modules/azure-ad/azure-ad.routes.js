'use strict';

const router = require('express').Router();
const controller = require('./azure-ad.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { syncUsersSchema } = require('./azure-ad.validation');

// All routes require a valid session
router.use(authenticate);

// ── Connection test (returns raw Graph error for debugging) ───────────────────
router.get('/test-connection', controller.testConnection);

// ── Filter helpers ────────────────────────────────────────────────────────────
router.get('/departments', controller.getDepartments);

// ── User list & detail ────────────────────────────────────────────────────────
router.get('/users',           controller.listUsers);
router.get('/users/:id',       controller.getUser);

// ── Relationships (used by org tree on-expand) ────────────────────────────────
router.get('/users/:id/direct-reports', controller.getUserDirectReports);

// ── Org hierarchy ─────────────────────────────────────────────────────────────
router.get('/org-tree/roots',  controller.getOrgTreeRoots);

// ── Sync Entra users → BrightNow (password create / email update, no email) ───
router.post(
  '/sync-users',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(syncUsersSchema),
  controller.syncUsers
);

// ── Cache management ──────────────────────────────────────────────────────────
router.delete('/cache', controller.clearCache);

module.exports = router;
