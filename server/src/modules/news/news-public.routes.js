const router = require('express').Router();
const engagement = require('./news-engagement.controller');
const validate = require('../../middleware/validate');
const schemas = require('./news-engagement.validation');

// No `authenticate` — these endpoints serve shared public read links.
router.get('/share/:token', validate(schemas.tokenParam), engagement.publicShare);

module.exports = router;
