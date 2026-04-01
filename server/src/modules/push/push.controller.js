const catchAsync = require('../../utils/catchAsync');
const pushService = require('./push.service');

const list = catchAsync(async (req, res) => {
  const result = await pushService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const campaign = await pushService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: campaign });
});

const create = catchAsync(async (req, res) => {
  const campaign = await pushService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: campaign });
});

const send = catchAsync(async (req, res) => {
  const campaign = await pushService.send(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: campaign });
});

const cancel = catchAsync(async (req, res) => {
  const campaign = await pushService.cancel(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: campaign });
});

module.exports = { list, getById, create, send, cancel };
