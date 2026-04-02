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
  const article = await newsService.publish(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const archive = catchAsync(async (req, res) => {
  const article = await newsService.archive(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: article });
});

const setAudience = catchAsync(async (req, res) => {
  const article = await newsService.setAudience(
    req.params.id, req.body.targets, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: article });
});

module.exports = { list, getById, create, update, remove, publish, archive, setAudience };
