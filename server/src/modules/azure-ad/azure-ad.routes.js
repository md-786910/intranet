'use strict';

const router = require('express').Router();
const controller = require('./azure-ad.controller');
const authenticate = require('../../middleware/authenticate');

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

// ── Cache management ──────────────────────────────────────────────────────────
router.delete('/cache', controller.clearCache);

module.exports = router;
