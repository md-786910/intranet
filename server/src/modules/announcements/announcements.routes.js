const router = require('express').Router();
const controller = require('./announcements.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const loadEntityScope = require('../../middleware/loadEntityScope');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./announcements.validation');

const loadAnnouncementScope = loadEntityScope('AnnouncementItem');

router.use(authenticate);

// Employee-facing marquee — auth only; service applies audience filtering.
router.get('/marquee', controller.marquee);

// Admin / editor permissions piggy-back on the existing NEWS module
// (OWNER / OFFICE_MANAGER / CONTENT_EDITOR already hold those rights).
router.get('/', authorize('NEWS', 'VIEW'), validate(schemas.listSchema), controller.list);
router.get('/:id', authorize('NEWS', 'VIEW'), validate(schemas.idParam), controller.getById);
router.post('/', authorize('NEWS', 'CREATE'), validate(schemas.createSchema), auditLogger('ANNOUNCEMENT_CREATED'), controller.create);
router.post('/publish-now', authorize('NEWS', 'PUBLISH'), validate(schemas.createSchema), auditLogger('ANNOUNCEMENT_PUBLISHED'), controller.createAndPublish);
router.put('/:id', loadAnnouncementScope, authorize('NEWS', 'EDIT'), validate(schemas.updateSchema), auditLogger('ANNOUNCEMENT_UPDATED'), controller.update);
router.delete('/:id', loadAnnouncementScope, authorize('NEWS', 'DELETE'), auditLogger('ANNOUNCEMENT_DELETED'), controller.remove);
router.post('/:id/publish', loadAnnouncementScope, authorize('NEWS', 'PUBLISH'), validate(schemas.publishSchema), auditLogger('ANNOUNCEMENT_PUBLISHED'), controller.publish);
router.post('/:id/unpublish', loadAnnouncementScope, authorize('NEWS', 'PUBLISH'), auditLogger('ANNOUNCEMENT_UNPUBLISHED'), controller.unpublish);
router.post('/:id/archive', loadAnnouncementScope, authorize('NEWS', 'EDIT'), auditLogger('ANNOUNCEMENT_ARCHIVED'), controller.archive);
router.post('/:id/audience', loadAnnouncementScope, authorize('NEWS', 'EDIT'), validate(schemas.setAudienceSchema), auditLogger('ANNOUNCEMENT_AUDIENCE_UPDATED'), controller.setAudience);
router.post('/bulk-restore', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('ANNOUNCEMENT_RESTORED'), controller.bulkRestore);
router.post('/bulk-purge', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('ANNOUNCEMENT_PURGED'), controller.bulkPurge);

module.exports = router;
