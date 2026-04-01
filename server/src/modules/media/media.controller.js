const catchAsync = require('../../utils/catchAsync');
const mediaService = require('./media.service');

const upload = catchAsync(async (req, res) => {
  const result = await mediaService.upload(req.file, req.user.user_id);
  res.status(201).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const asset = await mediaService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: asset });
});

const remove = catchAsync(async (req, res) => {
  const result = await mediaService.delete(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { upload, getById, remove };
