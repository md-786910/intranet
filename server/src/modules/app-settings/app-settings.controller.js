'use strict';

const catchAsync = require('../../utils/catchAsync');
const service = require('./app-settings.service');

const get = catchAsync(async (req, res) => {
  const data = await service.get();
  res.status(200).json({ status: 'success', data });
});

const update = catchAsync(async (req, res) => {
  const data = await service.update(req.body, req.user?.user_id, {
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.id || req.requestId || null,
  });
  res.status(200).json({ status: 'success', data });
});

module.exports = { get, update };
