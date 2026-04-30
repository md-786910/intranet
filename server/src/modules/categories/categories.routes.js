const router = require('express').Router();
const controller = require('./categories.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const schemas = require('./categories.validation');

router.use(authenticate);

router.get('/', validate(schemas.listSchema), controller.list);
router.post('/', validate(schemas.createSchema), controller.create);
router.post('/bulk-restore', validate(schemas.bulkRestoreSchema), controller.bulkRestore);
router.put('/:id', validate(schemas.updateSchema), controller.update);
router.delete('/:id', validate(schemas.idParam), controller.remove);

module.exports = router;
