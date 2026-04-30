const router = require('express').Router();
const controller = require('./news.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./news.validation');

router.use(authenticate);

router.get('/', authorize('NEWS', 'VIEW'), validate(schemas.listNewsSchema), controller.list);
router.get('/:id', authorize('NEWS', 'VIEW'), validate(schemas.idParam), controller.getById);
router.post('/', authorize('NEWS', 'CREATE'), validate(schemas.createNewsSchema), auditLogger('NEWS_CREATED'), controller.create);
router.put('/:id', authorize('NEWS', 'EDIT'), validate(schemas.updateNewsSchema), auditLogger('NEWS_UPDATED'), controller.update);
router.delete('/:id', authorize('NEWS', 'DELETE'), auditLogger('NEWS_DELETED'), controller.remove);
router.post('/:id/publish', authorize('NEWS', 'PUBLISH'), auditLogger('NEWS_PUBLISHED'), controller.publish);
router.post('/:id/unpublish', authorize('NEWS', 'PUBLISH'), auditLogger('NEWS_UNPUBLISHED'), controller.unpublish);
router.post('/:id/archive', authorize('NEWS', 'EDIT'), auditLogger('NEWS_ARCHIVED'), controller.archive);
router.post('/:id/audience', authorize('NEWS', 'EDIT'), validate(schemas.setAudienceSchema), controller.setAudience);
router.post('/bulk-restore', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('NEWS_RESTORED'), controller.bulkRestore);
router.post('/bulk-purge', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('NEWS_PURGED'), controller.bulkPurge);

module.exports = router;
