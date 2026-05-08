const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Whitelist of context-specific subdirectories under /uploads. Anything that
// doesn't match falls back to the root upload dir, so an unknown value can't
// be used to write outside of /uploads.
const ALLOWED_CONTEXTS = new Set(['document', 'news', 'general']);

function resolveContextDir(context) {
  if (!context || !ALLOWED_CONTEXTS.has(context)) return { dir: UPLOAD_DIR, urlPrefix: '/uploads' };
  const dir = path.join(UPLOAD_DIR, context);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return { dir, urlPrefix: `/uploads/${context}` };
}

const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'image/bmp', 'image/tiff', 'image/heic', 'image/heif', 'image/avif',
  // PDF (and the rare 'x-pdf' variant some browsers report)
  'application/pdf', 'application/x-pdf',
  // Word
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  // Excel
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // PowerPoint
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  // Open / Apple office formats
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'application/vnd.apple.pages', 'application/vnd.apple.numbers', 'application/vnd.apple.keynote',
  // Plain text & data
  'text/plain', 'text/csv', 'text/markdown', 'text/html',
  'application/json', 'application/xml', 'text/xml',
  'application/rtf',
  // Archives
  'application/zip', 'application/x-zip-compressed',
  'application/x-rar-compressed', 'application/vnd.rar',
  'application/x-7z-compressed',
  'application/x-tar', 'application/gzip',
  // Video
  'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo', 'video/x-matroska',
  // Audio
  'audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/webm', 'audio/ogg',
];

// 50 MB per file by default. Override with MEDIA_UPLOAD_MAX_BYTES (also
// honoured by multer's `limits.fileSize`).
const MAX_FILE_SIZE = Number(process.env.MEDIA_UPLOAD_MAX_BYTES) || 50 * 1024 * 1024;

const mediaService = {
  async upload(file, userId, options = {}) {
    const { MediaAsset } = require('../../database/models');

    if (!file) throw ApiError.badRequest('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw ApiError.badRequest(`File type ${file.mimetype} is not allowed`);
    }
    if (file.size > MAX_FILE_SIZE) {
      const limitMb = Math.round(MAX_FILE_SIZE / (1024 * 1024));
      throw ApiError.badRequest(`File size exceeds ${limitMb} MB limit`);
    }

    const { dir, urlPrefix } = resolveContextDir(options.context);
    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const storagePath = `${urlPrefix}/${fileName}`;
    const diskPath = path.join(dir, fileName);

    fs.renameSync(file.path, diskPath);

    const asset = await MediaAsset.create({
      tenant_id: DEFAULT_TENANT_ID,
      original_name: file.originalname,
      file_name: fileName,
      mime_type: file.mimetype,
      size_bytes: file.size,
      storage_path: storagePath,
      uploaded_by: userId,
    });

    return {
      media_asset_id: asset.media_asset_id,
      file_name: asset.file_name,
      original_name: asset.original_name,
      mime_type: asset.mime_type,
      size_bytes: asset.size_bytes,
      url: storagePath,
      created_at: asset.createdAt,
    };
  },

  async list(query) {
    const { MediaAsset, UserAccount } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);

    const trash = query.trash === true || query.trash === 'true';
    const where = trash
      ? { deleted_at: { [Op.ne]: null } }
      : { deleted_at: null };
    if (query.search) {
      where.original_name = { [Op.iLike]: `%${query.search}%` };
    }
    if (query.mime_prefix) {
      where.mime_type = { [Op.like]: `${query.mime_prefix}%` };
    }

    const order = trash ? [['deleted_at', 'DESC']] : [['created_at', 'DESC']];

    const Model = trash ? MediaAsset.unscoped() : MediaAsset;
    const { rows, count } = await Model.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [{
        model: UserAccount,
        as: 'uploader',
        attributes: ['user_id', 'first_name', 'last_name', 'email'],
      }],
    });

    return {
      assets: rows.map((asset) => ({
        media_asset_id: asset.media_asset_id,
        original_name: asset.original_name,
        file_name: asset.file_name,
        mime_type: asset.mime_type,
        size_bytes: Number(asset.size_bytes),
        storage_path: asset.storage_path,
        url: asset.storage_path,
        alt_text: asset.alt_text,
        created_at: asset.createdAt,
        deleted_at: asset.deleted_at,
        uploader: asset.uploader ? {
          user_id: asset.uploader.user_id,
          first_name: asset.uploader.first_name,
          last_name: asset.uploader.last_name,
          email: asset.uploader.email,
        } : null,
      })),
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const { MediaAsset } = require('../../database/models');
    const asset = await MediaAsset.findByPk(id);
    if (!asset) throw ApiError.notFound('Media asset not found');
    return asset;
  },

  async delete(id, userId) {  // eslint-disable-line no-unused-vars
    const { MediaAsset } = require('../../database/models');
    const asset = await MediaAsset.findByPk(id);
    if (!asset) throw ApiError.notFound('Media asset not found');

    // Soft delete only — file stays on disk so the user can restore from Trash.
    await asset.update({ deleted_at: new Date() });
    return { message: 'Media asset moved to trash' };
  },

  async bulkDelete(ids, userId) {  // eslint-disable-line no-unused-vars
    const { MediaAsset } = require('../../database/models');
    const assets = await MediaAsset.findAll({ where: { media_asset_id: ids, deleted_at: null } });

    let deleted = 0;
    for (const asset of assets) {
      await asset.update({ deleted_at: new Date() });
      deleted += 1;
    }

    return { deleted };
  },

  async bulkRestore(ids, userId) {  // eslint-disable-line no-unused-vars
    const { MediaAsset } = require('../../database/models');
    const assets = await MediaAsset.unscoped().findAll({
      where: { media_asset_id: ids, deleted_at: { [Op.ne]: null } },
    });

    let restored = 0;
    for (const asset of assets) {
      await asset.update({ deleted_at: null });
      restored += 1;
    }

    return { restored };
  },

  // Permanent purge — only allowed for assets already in trash. Unlinks the
  // file from disk and hard-deletes the DB row.
  async bulkPurge(ids, userId) {  // eslint-disable-line no-unused-vars
    const { MediaAsset } = require('../../database/models');
    const assets = await MediaAsset.unscoped().findAll({
      where: { media_asset_id: ids, deleted_at: { [Op.ne]: null } },
    });

    const uploadRoot = path.resolve(UPLOAD_DIR);
    let purged = 0;
    for (const asset of assets) {
      // Resolve a disk path from storage_path (e.g. "/uploads/news/abc.pdf")
      // and confirm it stays inside UPLOAD_DIR before unlinking.
      const relative = (asset.storage_path || '').replace(/^\/?uploads\/?/, '');
      if (relative) {
        const candidate = path.resolve(UPLOAD_DIR, relative);
        if (candidate.startsWith(uploadRoot + path.sep) || candidate === uploadRoot) {
          if (fs.existsSync(candidate)) {
            try { fs.unlinkSync(candidate); } catch (_) { /* ignore disk errors */ }
          }
        }
      }
      await asset.destroy({ force: true });
      purged += 1;
    }

    return { purged };
  },
};

module.exports = mediaService;
