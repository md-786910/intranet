const catchAsync = require('../../utils/catchAsync');
const rolesService = require('./roles.service');

const list = catchAsync(async (req, res) => {
  const result = await rolesService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const listModules = catchAsync(async (req, res) => {
  const modules = await rolesService.listModules();
  res.status(200).json({ status: 'success', data: modules });
});

const getById = catchAsync(async (req, res) => {
  const role = await rolesService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: role });
});

const create = catchAsync(async (req, res) => {
  const role = await rolesService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: role });
});

const update = catchAsync(async (req, res) => {
  const role = await rolesService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: role });
});

const remove = catchAsync(async (req, res) => {
  const result = await rolesService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const clone = catchAsync(async (req, res) => {
  const role = await rolesService.clone(req.params.id, req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: role });
});

module.exports = {
  list,
  listModules,
  getById,
  create,
  update,
  remove,
  clone,
};
