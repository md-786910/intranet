const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const categoriesService = require('./categories.service');
const permissionService = require('../../services/permission.service');
const scopeVisibilityService = require('../../services/scope-visibility.service');

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

// Non-Owners can mutate any category created by a user in their
// collaborator peer set (same scope-overlap rule used for visibility).
// Owners / ORG-scope managers can touch any category. This mirrors the
// read filter in categories.service.list so visibility and editability
// stay symmetric — "if you see it, you can edit it".
async function assertCanMutateCategory(userId, category) {
  const moduleCode = moduleForEntity(category.entity_type);
  if (await permissionService.isGlobalManager(userId, moduleCode)) return;

  const peerUserIds = await scopeVisibilityService.getCollaboratorUserIds(userId, [moduleCode]);
  if (peerUserIds === null) return; // helper short-circuit: global access

  if (!category.creator_id || !peerUserIds.includes(category.creator_id)) {
    throw ApiError.forbidden('You can only modify categories in your scope');
  }
}

const list = catchAsync(async (req, res) => {
  await requireManage(req.user.user_id, req.query.entity_type);
  const result = await categoriesService.list(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const create = catchAsync(async (req, res) => {
  await requireManage(req.user.user_id, req.body.entity_type);
  const result = await categoriesService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: result });
});

const update = catchAsync(async (req, res) => {
  const existing = await categoriesService.getById(req.params.id);
  await requireManage(req.user.user_id, existing.entity_type);
  await assertCanMutateCategory(req.user.user_id, existing);
  const result = await categoriesService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const remove = catchAsync(async (req, res) => {
  const existing = await categoriesService.getById(req.params.id);
  await requireDelete(req.user.user_id, existing.entity_type);
  await assertCanMutateCategory(req.user.user_id, existing);
  const result = await categoriesService.softDelete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkRestore = catchAsync(async (req, res) => {
  if (!req.body.ids || req.body.ids.length === 0) {
    throw ApiError.badRequest('ids is required');
  }
  // All ids must share an entity_type and the user must have its DELETE permission.
  const first = await categoriesService.getById(req.body.ids[0]);
  await requireDelete(req.user.user_id, first.entity_type);
  // Non-Owners can only restore their own categories — fail-fast on the first
  // mismatch rather than partially restoring.
  for (const cid of req.body.ids) {
    const cat = await categoriesService.getById(cid); // eslint-disable-line no-await-in-loop
    await assertCanMutateCategory(req.user.user_id, cat); // eslint-disable-line no-await-in-loop
  }
  const result = await categoriesService.bulkRestore(req.body.ids, first.entity_type);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list, create, update, remove, bulkRestore };
