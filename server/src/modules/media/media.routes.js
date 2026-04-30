const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const controller = require('./media.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const schemas = require('./media.validation');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

router.use(authenticate);

router.get('/', validate(schemas.listSchema), controller.list);
router.post('/upload', upload.single('file'), controller.upload);
router.post('/bulk-delete', validate(schemas.bulkDeleteSchema), controller.bulkRemove);
router.post('/bulk-restore', validate(schemas.bulkRestoreSchema), controller.bulkRestore);
router.post('/bulk-purge', validate(schemas.bulkRestoreSchema), controller.bulkPurge);
router.get('/:id', validate(schemas.idParam), controller.getById);
router.delete('/:id', validate(schemas.idParam), controller.remove);

module.exports = router;
