const catchAsync = require('../../utils/catchAsync');
const service = require('./notifications.service');

const list = catchAsync(async (req, res) => {
  const data = await service.list(req.user.user_id, req.query);
  res.status(200).json({ status: 'success', data });
});

const unreadCount = catchAsync(async (req, res) => {
  const data = await service.getUnreadCount(req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

const markRead = catchAsync(async (req, res) => {
  const data = await service.markRead(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

const markAllRead = catchAsync(async (req, res) => {
  const data = await service.markAllRead(req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

module.exports = { list, unreadCount, markRead, markAllRead };
