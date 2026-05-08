const catchAsync = require('../../utils/catchAsync');
const documentsService = require('./documents.service');

const list = catchAsync(async (req, res) => {
  const result = await documentsService.list(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const doc = await documentsService.getById(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: doc });
});

const create = catchAsync(async (req, res) => {
  const doc = await documentsService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: doc });
});

const update = catchAsync(async (req, res) => {
  const doc = await documentsService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: doc });
});

const remove = catchAsync(async (req, res) => {
  const result = await documentsService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const publish = catchAsync(async (req, res) => {
  const doc = await documentsService.publish(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: doc });
});

const unpublish = catchAsync(async (req, res) => {
  const doc = await documentsService.unpublish(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: doc });
});

const bulkRestore = catchAsync(async (req, res) => {
  const result = await documentsService.bulkRestore(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkPurge = catchAsync(async (req, res) => {
  const result = await documentsService.bulkPurge(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const listVersions = catchAsync(async (req, res) => {
  const versions = await documentsService.listVersions(req.params.id);
  res.status(200).json({ status: 'success', data: versions });
});

const createVersion = catchAsync(async (req, res) => {
  const version = await documentsService.createVersion(req.params.id, req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: version });
});

const listCategories = catchAsync(async (req, res) => {
  // ?for_user=true → restrict to categories with at least one visible document
  // for the calling user, with live doc_count attached. Without it, returns
  // every DOCUMENT category (admin dropdown flow).
  const forUser = req.query.for_user === 'true';
  const categories = await documentsService.listCategories(forUser ? req.user.user_id : null);
  res.status(200).json({ status: 'success', data: categories });
});

const recordView = catchAsync(async (req, res) => {
  const result = await documentsService.recordView(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const listRecentlyViewed = catchAsync(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 10, 50);
  const result = await documentsService.listRecentlyViewed(req.user.user_id, limit);
  res.status(200).json({ status: 'success', data: result });
});

const getFeatured = catchAsync(async (req, res) => {
  const result = await documentsService.getFeatured(req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const getStorageSummary = catchAsync(async (req, res) => {
  const result = await documentsService.getStorageSummary(req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const createCategory = catchAsync(async (req, res) => {
  const category = await documentsService.createCategory(req.body);
  res.status(201).json({ status: 'success', data: category });
});

const updateCategory = catchAsync(async (req, res) => {
  const category = await documentsService.updateCategory(req.params.categoryId, req.body);
  res.status(200).json({ status: 'success', data: category });
});

const deleteCategory = catchAsync(async (req, res) => {
  const result = await documentsService.deleteCategory(req.params.categoryId);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  list, getById, create, update, remove, publish, unpublish,
  bulkRestore, bulkPurge,
  listVersions, createVersion,
  listCategories, createCategory, updateCategory, deleteCategory,
  recordView, listRecentlyViewed, getFeatured, getStorageSummary,
};
