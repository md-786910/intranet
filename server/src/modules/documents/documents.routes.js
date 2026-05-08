const router = require('express').Router();
const controller = require('./documents.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./documents.validation');

router.use(authenticate);

// ── Categories (must be before /:id to avoid param matching) ──
router.get('/categories', authorize('DOCUMENTS', 'VIEW'), controller.listCategories);
router.post('/categories', authorize('DOCUMENTS', 'CREATE'), validate(schemas.createCategorySchema), controller.createCategory);
router.put('/categories/:categoryId', authorize('DOCUMENTS', 'EDIT'), validate(schemas.updateCategorySchema), controller.updateCategory);
router.delete('/categories/:categoryId', authorize('DOCUMENTS', 'DELETE'), validate(schemas.categoryIdParam), controller.deleteCategory);

// ── Employee dashboard widgets (specific paths, before /:id) ──
router.get('/recently-viewed', authorize('DOCUMENTS', 'VIEW'), controller.listRecentlyViewed);
router.get('/featured', authorize('DOCUMENTS', 'VIEW'), controller.getFeatured);
router.get('/storage-summary', authorize('DOCUMENTS', 'VIEW'), controller.getStorageSummary);

// ── Documents ──
router.get('/', authorize('DOCUMENTS', 'VIEW'), validate(schemas.listDocsSchema), controller.list);
router.get('/:id', authorize('DOCUMENTS', 'VIEW'), validate(schemas.idParam), controller.getById);
router.post('/:id/view', authorize('DOCUMENTS', 'VIEW'), validate(schemas.idParam), controller.recordView);
router.post('/', authorize('DOCUMENTS', 'CREATE'), validate(schemas.createDocSchema), auditLogger('DOC_CREATED'), controller.create);
router.put('/:id', authorize('DOCUMENTS', 'EDIT'), validate(schemas.updateDocSchema), auditLogger('DOC_UPDATED'), controller.update);
router.delete('/:id', authorize('DOCUMENTS', 'DELETE'), auditLogger('DOC_DELETED'), controller.remove);
router.post('/:id/publish', authorize('DOCUMENTS', 'PUBLISH'), auditLogger('DOC_PUBLISHED'), controller.publish);
router.post('/:id/unpublish', authorize('DOCUMENTS', 'PUBLISH'), auditLogger('DOC_UNPUBLISHED'), controller.unpublish);
router.post('/bulk-restore', authorize('DOCUMENTS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('DOC_RESTORED'), controller.bulkRestore);
router.post('/bulk-purge', authorize('DOCUMENTS', 'DELETE'), validate(schemas.bulkIdsSchema), auditLogger('DOC_PURGED'), controller.bulkPurge);

// ── Versions ──
router.get('/:id/versions', authorize('DOCUMENTS', 'VIEW'), validate(schemas.idParam), controller.listVersions);
router.post('/:id/versions', authorize('DOCUMENTS', 'EDIT'), validate(schemas.createVersionSchema), auditLogger('DOC_VERSION_CREATED'), controller.createVersion);

module.exports = router;
