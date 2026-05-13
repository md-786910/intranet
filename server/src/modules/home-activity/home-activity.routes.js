const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const controller = require('./home-activity.controller');

router.use(authenticate);

router.get('/recent-activity', controller.list);

module.exports = router;
