const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const categoriesService = require('./categories.service');
const permissionService = require('../../services/permission.service');

function moduleForEntity(entityType) {
  return entityType === 'NEWS' ? 'NEWS' : 'DOCUMENTS';
}

async function requireManage(userId, entityType) {
  const mod = moduleForEntity(entityType);
  const allowed = await permissionService.hasPermissionAnywhere(userId, mod, 'EDIT');
  if (!allowed) {
    throw ApiError.forbidden(`You do not have permission to manage ${entityType.toLowerCase()} categories`);
  }
}

async function requireDelete(userId, entityType) {
  const mod = moduleForEntity(entityType);
  const allowed = await permissionService.hasPermissionAnywhere(userId, mod, 'DELETE');
  if (!allowed) {
    throw ApiError.forbidden(`You do not have permission to delete ${entityType.toLowerCase()} categories`);
  }
}

const list = catchAsync(async (req, res) => {
  await requireManage(req.user.user_id, req.query.entity_type);
  const result = await categoriesService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const create = catchAsync(async (req, res) => {
  await requireManage(req.user.user_id, req.body.entity_type);
  const result = await categoriesService.create(req.body);
  res.status(201).json({ status: 'success', data: result });
});

const update = catchAsync(async (req, res) => {
  const existing = await categoriesService.getById(req.params.id);
  await requireManage(req.user.user_id, existing.entity_type);
  const result = await categoriesService.update(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: result });
});

const remove = catchAsync(async (req, res) => {
  const existing = await categoriesService.getById(req.params.id);
  await requireDelete(req.user.user_id, existing.entity_type);
  const result = await categoriesService.softDelete(req.params.id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkRestore = catchAsync(async (req, res) => {
  if (!req.body.ids || req.body.ids.length === 0) {
    throw ApiError.badRequest('ids is required');
  }
  // All ids must share an entity_type and the user must have its DELETE permission.
  const first = await categoriesService.getById(req.body.ids[0]);
  await requireDelete(req.user.user_id, first.entity_type);
  const result = await categoriesService.bulkRestore(req.body.ids, first.entity_type);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list, create, update, remove, bulkRestore };
