const catchAsync = require('../../utils/catchAsync');
const newsService = require('./news.service');

const list = catchAsync(async (req, res) => {
  const result = await newsService.list(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const article = await newsService.getById(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const create = catchAsync(async (req, res) => {
  const article = await newsService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: article });
});

const update = catchAsync(async (req, res) => {
  const article = await newsService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const remove = catchAsync(async (req, res) => {
  const result = await newsService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const publish = catchAsync(async (req, res) => {
  const article = await newsService.publish(req.params.id, req.user.user_id, {
    pushNotify: req.body?.push_notify,
  });
  res.status(200).json({ status: 'success', data: article });
});

const createAndPublish = catchAsync(async (req, res) => {
  const article = await newsService.createAndPublish(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: article });
});

const resendNotification = catchAsync(async (req, res) => {
  const result = await newsService.resendNotification(req.params.id);
  res.status(200).json({ status: 'success', data: result });
});

const archive = catchAsync(async (req, res) => {
  const article = await newsService.archive(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const unpublish = catchAsync(async (req, res) => {
  const article = await newsService.unpublish(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const setAudience = catchAsync(async (req, res) => {
  const article = await newsService.setAudience(
    req.params.id, req.body.targets, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: article });
});

const bulkRestore = catchAsync(async (req, res) => {
  const result = await newsService.bulkRestore(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkPurge = catchAsync(async (req, res) => {
  const result = await newsService.bulkPurge(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list, getById, create, update, remove, publish, createAndPublish, resendNotification, unpublish, archive, setAudience, bulkRestore, bulkPurge };
