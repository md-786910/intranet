const catchAsync = require('../../utils/catchAsync');
const service = require('./job-titles.service');

const list   = catchAsync(async (req, res) => { res.status(200).json({ status: 'success', data: await service.list() }); });
const create = catchAsync(async (req, res) => { res.status(201).json({ status: 'success', data: await service.create(req.body) }); });
const update = catchAsync(async (req, res) => { res.status(200).json({ status: 'success', data: await service.update(req.params.id, req.body) }); });
const remove = catchAsync(async (req, res) => { res.status(200).json({ status: 'success', data: await service.remove(req.params.id) }); });

module.exports = { list, create, update, remove };
