const catchAsync = require('../../utils/catchAsync');
const service = require('./job-titles.service');

const list = catchAsync(async (req, res) => {
  const data = await service.list();
  res.status(200).json({ status: 'success', data });
});

const create = catchAsync(async (req, res) => {
  const data = await service.create(req.body);
  res.status(201).json({ status: 'success', data });
});

const update = catchAsync(async (req, res) => {
  const data = await service.update(req.params.id, req.body);
  res.status(200).json({ status: 'success', data });
});

const remove = catchAsync(async (req, res) => {
  const data = await service.remove(req.params.id);
  res.status(200).json({ status: 'success', data });
});

const reorder = catchAsync(async (req, res) => {
  const data = await service.reorder(req.body.ordered_ids);
  res.status(200).json({ status: 'success', data });
});

module.exports = { list, create, update, remove, reorder };
