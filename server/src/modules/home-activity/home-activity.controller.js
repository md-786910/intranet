const catchAsync = require('../../utils/catchAsync');
const homeActivityService = require('./home-activity.service');

// Auth-only endpoint — every authenticated employee can read their feed.
// No permission gate: the service already filters events by audience scope
// keys + departmental hierarchy, so users can only see events they could
// already encounter elsewhere in the app.
const list = catchAsync(async (req, res) => {
  const result = await homeActivityService.list(req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list };
