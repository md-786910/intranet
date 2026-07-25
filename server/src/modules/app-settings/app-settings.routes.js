'use strict';

const router = require('express').Router();
const controller = require('./app-settings.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const { updateSchema } = require('./app-settings.validation');

router.use(authenticate);

// Any authenticated user may read (admin + employee shells).
router.get('/', controller.get);

router.put(
  '/',
  authorize('ADMIN', 'MANAGE_USERS'),
  validate(updateSchema),
  controller.update,
);

module.exports = router;
