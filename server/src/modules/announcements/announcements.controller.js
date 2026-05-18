const catchAsync = require('../../utils/catchAsync');
const announcementsService = require('./announcements.service');

const list = catchAsync(async (req, res) => {
  const result = await announcementsService.list(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const item = await announcementsService.getById(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const create = catchAsync(async (req, res) => {
  const item = await announcementsService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: item });
});

const createAndPublish = catchAsync(async (req, res) => {
  const item = await announcementsService.createAndPublish(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: item });
});

const schedule = catchAsync(async (req, res) => {
  const item = await announcementsService.schedule(
    req.params.id,
    req.user.user_id,
    req.body.scheduled_at,
  );
  res.status(200).json({ status: 'success', data: item });
});

const unschedule = catchAsync(async (req, res) => {
  const item = await announcementsService.unschedule(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const createAndSchedule = catchAsync(async (req, res) => {
  const item = await announcementsService.createAndSchedule(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: item });
});

const update = catchAsync(async (req, res) => {
  const item = await announcementsService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const remove = catchAsync(async (req, res) => {
  const result = await announcementsService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const publish = catchAsync(async (req, res) => {
  const item = await announcementsService.publish(req.params.id, req.user.user_id, {
    pushNotify: req.body?.push_notify,
  });
  res.status(200).json({ status: 'success', data: item });
});

const unpublish = catchAsync(async (req, res) => {
  const item = await announcementsService.unpublish(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const archive = catchAsync(async (req, res) => {
  const item = await announcementsService.archive(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const setAudience = catchAsync(async (req, res) => {
  const item = await announcementsService.setAudience(req.params.id, req.body.targets, req.user.user_id);
  res.status(200).json({ status: 'success', data: item });
});

const bulkRestore = catchAsync(async (req, res) => {
  const result = await announcementsService.bulkRestore(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const bulkPurge = catchAsync(async (req, res) => {
  const result = await announcementsService.bulkPurge(req.body.ids, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const marquee = catchAsync(async (req, res) => {
  const result = await announcementsService.listMarquee(req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  list,
  getById,
  create,
  createAndPublish,
  update,
  remove,
  publish,
  unpublish,
  archive,
  schedule,
  unschedule,
  createAndSchedule,
  setAudience,
  bulkRestore,
  bulkPurge,
  marquee,
};
