const catchAsync = require('../../utils/catchAsync');
const documentsService = require('./documents.service');

const list = catchAsync(async (req, res) => {
  const result = await documentsService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const doc = await documentsService.getById(req.params.id);
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

const listVersions = catchAsync(async (req, res) => {
  const versions = await documentsService.listVersions(req.params.id);
  res.status(200).json({ status: 'success', data: versions });
});

const createVersion = catchAsync(async (req, res) => {
  const version = await documentsService.createVersion(req.params.id, req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: version });
});

const listCategories = catchAsync(async (req, res) => {
  const categories = await documentsService.listCategories();
  res.status(200).json({ status: 'success', data: categories });
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
  list, getById, create, update, remove, publish,
  listVersions, createVersion,
  listCategories, createCategory, updateCategory, deleteCategory,
};
