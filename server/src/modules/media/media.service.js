const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain', 'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const mediaService = {
  async upload(file, userId) {
    const { MediaAsset } = require('../../database/models');

    if (!file) throw ApiError.badRequest('No file uploaded');
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw ApiError.badRequest(`File type ${file.mimetype} is not allowed`);
    }
    if (file.size > MAX_FILE_SIZE) {
      throw ApiError.badRequest('File size exceeds 10MB limit');
    }

    const ext = path.extname(file.originalname);
    const fileName = `${uuidv4()}${ext}`;
    const storagePath = `/uploads/${fileName}`;

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
    };
  },

  async getById(id) {
    const { MediaAsset } = require('../../database/models');
    const asset = await MediaAsset.findByPk(id);
    if (!asset) throw ApiError.notFound('Media asset not found');
    return asset;
  },

  async delete(id, userId) {
    const { MediaAsset } = require('../../database/models');
    const asset = await MediaAsset.findByPk(id);
    if (!asset) throw ApiError.notFound('Media asset not found');

    // Delete file from disk
    const filePath = path.join(UPLOAD_DIR, asset.file_name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await asset.update({ deleted_at: new Date() });
    return { message: 'Media asset deleted successfully' };
  },
};

module.exports = mediaService;
