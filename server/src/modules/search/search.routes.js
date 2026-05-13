const router = require('express').Router();
const authenticate = require('../../middleware/authenticate');
const controller = require('./search.controller');

router.use(authenticate);

router.get('/', controller.search);

module.exports = router;
