const router = require('express').Router();
const controller = require('./push.controller');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const validate = require('../../middleware/validate');
const auditLogger = require('../../middleware/auditLogger');
const schemas = require('./push.validation');

router.use(authenticate);

router.get('/', authorize('PUSH', 'VIEW'), validate(schemas.listPushSchema), controller.list);
router.get('/:id', authorize('PUSH', 'VIEW'), validate(schemas.idParam), controller.getById);
router.post('/', authorize('PUSH', 'CREATE'), validate(schemas.createPushSchema), auditLogger('PUSH_CREATED'), controller.create);
router.post('/:id/send', authorize('PUSH', 'SEND'), auditLogger('PUSH_SENT'), controller.send);
router.post('/:id/cancel', authorize('PUSH', 'CANCEL'), auditLogger('PUSH_CANCELLED'), controller.cancel);

module.exports = router;
