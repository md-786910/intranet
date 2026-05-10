const catchAsync = require('../../utils/catchAsync');
const orgService = require('./org.service');

const getTree = catchAsync(async (req, res) => {
  const tree = await orgService.getFullTree();
  res.status(200).json({ status: 'success', data: tree });
});

const getById = catchAsync(async (req, res) => {
  const node = await orgService.getNodeById(req.params.id);
  res.status(200).json({ status: 'success', data: node });
});

const getChildren = catchAsync(async (req, res) => {
  const children = await orgService.getChildren(req.params.id);
  res.status(200).json({ status: 'success', data: children });
});

const getSubtree = catchAsync(async (req, res) => {
  const subtree = await orgService.getSubtree(req.params.id);
  res.status(200).json({ status: 'success', data: subtree });
});

const getMyVertical = catchAsync(async (req, res) => {
  const peopleLimit = Number(req.query.peopleLimit) || undefined;
  const result = await orgService.getMyVertical(req.user.user_id, { peopleLimit });
  res.status(200).json({ status: 'success', data: result });
});

const getMyHierarchy = catchAsync(async (req, res) => {
  const result = await orgService.getMyHierarchy(req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const getPeopleTree = catchAsync(async (req, res) => {
  const result = await orgService.getPeopleTree();
  res.status(200).json({ status: 'success', data: result });
});

// Office Locations
const createOfficeLocation = catchAsync(async (req, res) => {
  const office = await orgService.createOfficeLocation(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: office });
});

const updateOfficeLocation = catchAsync(async (req, res) => {
  const office = await orgService.updateOfficeLocation(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: office });
});

const deleteOfficeLocation = catchAsync(async (req, res) => {
  const result = await orgService.deleteOfficeLocation(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

// Verticals
const createVertical = catchAsync(async (req, res) => {
  const vertical = await orgService.createVertical(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: vertical });
});

const updateVertical = catchAsync(async (req, res) => {
  const vertical = await orgService.updateVertical(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: vertical });
});

const deleteVertical = catchAsync(async (req, res) => {
  const result = await orgService.deleteVertical(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

// Departments
const createDepartment = catchAsync(async (req, res) => {
  const department = await orgService.createDepartment(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: department });
});

const updateDepartment = catchAsync(async (req, res) => {
  const department = await orgService.updateDepartment(req.params.id, req.body);
  res.status(200).json({ status: 'success', data: department });
});

const deleteDepartment = catchAsync(async (req, res) => {
  const result = await orgService.deleteDepartment(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  getTree,
  getMyVertical,
  getMyHierarchy,
  getPeopleTree,
  getById,
  getChildren,
  getSubtree,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
  createVertical,
  updateVertical,
  deleteVertical,
  createDepartment,
  updateDepartment,
  deleteDepartment,
};
