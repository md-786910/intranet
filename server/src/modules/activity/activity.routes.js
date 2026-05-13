const router = require('express').Router();
const controller = require('./activity.controller');
const authenticate = require('../../middleware/authenticate');

router.use(authenticate);

router.get('/', controller.list);

module.exports = router;
