const catchAsync = require('../../utils/catchAsync');
const employeesService = require('./employees.service');

const list = catchAsync(async (req, res) => {
  const result = await employeesService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const employee = await employeesService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: employee });
});

const create = catchAsync(async (req, res) => {
  const employee = await employeesService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: employee });
});

const update = catchAsync(async (req, res) => {
  const employee = await employeesService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: employee });
});

const softDelete = catchAsync(async (req, res) => {
  const result = await employeesService.softDelete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const resendInvite = catchAsync(async (req, res) => {
  const result = await employeesService.resendInvite(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  list,
  getById,
  create,
  update,
  softDelete,
  resendInvite,
};
