const router = require('express').Router();
const controller = require('./notifications.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const schemas = require('./notifications.validation');

router.use(authenticate);

// All routes are user-scoped — the service filters by req.user.user_id, so
// no `authorize()` middleware is needed. Every authenticated user can read,
// mark-read, and clear their own notifications.

router.get('/', validate(schemas.listQuery), controller.list);
router.get('/unread-count', controller.unreadCount);
router.post('/:id/read', validate(schemas.idParam), controller.markRead);
router.post('/mark-all-read', controller.markAllRead);

module.exports = router;
