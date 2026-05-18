const router = require('express').Router();
const controller = require('./news.controller');
const engagement = require('./news-engagement.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const loadEntityScope = require('../../middleware/loadEntityScope');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./news.validation');
const engagementSchemas = require('./news-engagement.validation');

const loadNewsScope = loadEntityScope('NewsItem');

router.use(authenticate);

router.get('/', authorize('NEWS', 'VIEW'), validate(schemas.listNewsSchema), controller.list);
router.get('/:id', authorize('NEWS', 'VIEW'), validate(schemas.idParam), controller.getById);
router.post('/', authorize('NEWS', 'CREATE'), validate(schemas.createNewsSchema), auditLogger('NEWS_CREATED'), controller.create);
// "Publish Now" — create and immediately publish in one shot. Requires the
// same payload as create plus the PUBLISH permission. Fires notifications.
router.post('/publish-now', authorize('NEWS', 'PUBLISH'), validate(schemas.createNewsSchema), auditLogger('NEWS_PUBLISHED'), controller.createAndPublish);
router.put('/:id', loadNewsScope, authorize('NEWS', 'EDIT'), validate(schemas.updateNewsSchema), auditLogger('NEWS_UPDATED'), controller.update);
router.delete('/:id', loadNewsScope, authorize('NEWS', 'DELETE'), auditLogger('NEWS_DELETED'), controller.remove);
router.post('/:id/publish', loadNewsScope, authorize('NEWS', 'PUBLISH'), validate(schemas.publishSchema), auditLogger('NEWS_PUBLISHED'), controller.publish);
// Re-send the publish notification for an already-published article.
router.post('/:id/notify', loadNewsScope, authorize('NEWS', 'PUBLISH'), validate(schemas.idParam), controller.resendNotification);
router.post('/:id/unpublish', loadNewsScope, authorize('NEWS', 'PUBLISH'), auditLogger('NEWS_UNPUBLISHED'), controller.unpublish);
router.post('/:id/archive', loadNewsScope, authorize('NEWS', 'EDIT'), auditLogger('NEWS_ARCHIVED'), controller.archive);
router.post('/:id/audience', loadNewsScope, authorize('NEWS', 'EDIT'), validate(schemas.setAudienceSchema), controller.setAudience);
router.post('/bulk-restore', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('NEWS_RESTORED'), controller.bulkRestore);
router.post('/bulk-purge', authorize('NEWS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('NEWS_PURGED'), controller.bulkPurge);

// ── Engagement (employee) ──
// Authentication only at the route layer. The service's `assertVisibleAndLoad`
// is the gate: it loads the article, runs the audience-rule match, and throws
// 404 if the caller can't see it. The strict-scope `authorize` middleware
// would mis-fire here (it falls back to ORGANISATION scope for non-GET, which
// regular employees don't hold).
router.post('/:id/like', validate(engagementSchemas.idParam), engagement.like);
router.delete('/:id/like', validate(engagementSchemas.idParam), engagement.unlike);
router.get('/:id/comments', validate(engagementSchemas.listCommentsSchema), engagement.listComments);
router.post('/:id/comments', validate(engagementSchemas.createCommentSchema), engagement.addComment);
router.delete('/:id/comments/:commentId', validate(engagementSchemas.newsAndCommentParams), engagement.deleteComment);
router.post('/:id/share', validate(engagementSchemas.shareSchema), engagement.share);
router.post('/:id/save', validate(engagementSchemas.idParam), engagement.save);
router.delete('/:id/save', validate(engagementSchemas.idParam), engagement.unsave);

// ── Engagement (admin) — NEWS:EDIT ──
router.get('/:id/engagement', authorize('NEWS', 'EDIT'), validate(engagementSchemas.idParam), engagement.adminEngagementSummary);
router.get('/:id/engagement/likes', authorize('NEWS', 'EDIT'), validate(engagementSchemas.adminListSchema), engagement.adminListLikes);
router.get('/:id/engagement/comments', authorize('NEWS', 'EDIT'), validate(engagementSchemas.adminListSchema), engagement.adminListComments);
router.get('/:id/engagement/shares', authorize('NEWS', 'EDIT'), validate(engagementSchemas.adminListSchema), engagement.adminListShares);
router.delete('/:id/engagement/comments/:commentId', authorize('NEWS', 'EDIT'), validate(engagementSchemas.newsAndCommentParams), engagement.adminModerateComment);

module.exports = router;
