const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const mediaService = require('./media.service');
const permissionService = require('../../services/permission.service');

async function requireMediaAccess(userId) {
  const [canCreateDocs, canCreateNews] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'CREATE'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'CREATE'),
  ]);
  if (!canCreateDocs && !canCreateNews) {
    throw ApiError.forbidden('You do not have access to the media library');
  }
}

async function requireMediaDelete(userId) {
  const [canDeleteDocs, canDeleteNews] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'DELETE'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'DELETE'),
  ]);
  if (!canDeleteDocs && !canDeleteNews) {
    throw ApiError.forbidden('You do not have permission to delete media assets');
  }
}

const upload = catchAsync(async (req, res) => {
  await requireMediaAccess(req.user.user_id);
  const context = req.body?.context || req.query?.context;
  const result = await mediaService.upload(req.file, req.user.user_id, { context });
  res.status(201).json({ status: 'success', data: result });
});

const list = catchAsync(async (req, res) => {
  await requireMediaAccess(req.user.user_id);
  const result = await mediaService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  await requireMediaAccess(req.user.user_id);
  const asset = await mediaService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: asset });
});

const remove = catchAsync(async (req, res) => {
  await requireMediaDelete(req.user.user_id);
  const result = await mediaService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkRemove = catchAsync(async (req, res) => {
  await requireMediaDelete(req.user.user_id);
  const result = await mediaService.bulkDelete(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkRestore = catchAsync(async (req, res) => {
  await requireMediaDelete(req.user.user_id);
  const result = await mediaService.bulkRestore(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkPurge = catchAsync(async (req, res) => {
  await requireMediaDelete(req.user.user_id);
  const result = await mediaService.bulkPurge(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { upload, list, getById, remove, bulkRemove, bulkRestore, bulkPurge };
