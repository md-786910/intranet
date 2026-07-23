const catchAsync = require('../../utils/catchAsync');
const analyticsService = require('./analytics.service');

const dashboard = catchAsync(async (req, res) => {
  const result = await analyticsService.getDashboard();
  res.status(200).json({ status: 'success', data: result });
});

const content = catchAsync(async (req, res) => {
  const result = await analyticsService.getContentMetrics(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const users = catchAsync(async (req, res) => {
  const result = await analyticsService.getUserMetrics(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const push = catchAsync(async (req, res) => {
  const result = await analyticsService.getPushMetrics(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const contentWorkspace = catchAsync(async (req, res) => {
  const result = await analyticsService.getContentWorkspace(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { dashboard, content, users, push, contentWorkspace };
