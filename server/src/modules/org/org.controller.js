const catchAsync = require('../../utils/catchAsync');
const orgService = require('./org.service');
const { NODE_TYPES } = require('../../utils/constants');

const getTree = catchAsync(async (req, res) => {
  const tree = await orgService.getFullTree();
  res.status(200).json({ status: 'success', data: tree });
});

const getById = catchAsync(async (req, res) => {
  const orgUnit = await orgService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: orgUnit });
});

const getChildren = catchAsync(async (req, res) => {
  const children = await orgService.getChildren(req.params.id);
  res.status(200).json({ status: 'success', data: children });
});

const getSubtree = catchAsync(async (req, res) => {
  const subtree = await orgService.getSubtree(req.params.id, req.query);
  res.status(200).json({ status: 'success', data: subtree });
});

// Office Locations
const createOfficeLocation = catchAsync(async (req, res) => {
  const orgUnit = await orgService.createNode(
    { ...req.body, node_type: NODE_TYPES.OFFICE_LOCATION },
    req.user.user_id
  );
  res.status(201).json({ status: 'success', data: orgUnit });
});

const updateOfficeLocation = catchAsync(async (req, res) => {
  const orgUnit = await orgService.updateNode(
    req.params.id, NODE_TYPES.OFFICE_LOCATION, req.body
  );
  res.status(200).json({ status: 'success', data: orgUnit });
});

const deleteOfficeLocation = catchAsync(async (req, res) => {
  const result = await orgService.deleteNode(
    req.params.id, NODE_TYPES.OFFICE_LOCATION, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: result });
});

// Verticals
const createVertical = catchAsync(async (req, res) => {
  const orgUnit = await orgService.createNode(
    { ...req.body, node_type: NODE_TYPES.VERTICAL },
    req.user.user_id
  );
  res.status(201).json({ status: 'success', data: orgUnit });
});

const updateVertical = catchAsync(async (req, res) => {
  const orgUnit = await orgService.updateNode(
    req.params.id, NODE_TYPES.VERTICAL, req.body
  );
  res.status(200).json({ status: 'success', data: orgUnit });
});

const deleteVertical = catchAsync(async (req, res) => {
  const result = await orgService.deleteNode(
    req.params.id, NODE_TYPES.VERTICAL, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: result });
});

// Departments
const createDepartment = catchAsync(async (req, res) => {
  const orgUnit = await orgService.createNode(
    { ...req.body, node_type: NODE_TYPES.DEPARTMENT },
    req.user.user_id
  );
  res.status(201).json({ status: 'success', data: orgUnit });
});

const updateDepartment = catchAsync(async (req, res) => {
  const orgUnit = await orgService.updateNode(
    req.params.id, NODE_TYPES.DEPARTMENT, req.body
  );
  res.status(200).json({ status: 'success', data: orgUnit });
});

const deleteDepartment = catchAsync(async (req, res) => {
  const result = await orgService.deleteNode(
    req.params.id, NODE_TYPES.DEPARTMENT, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: result });
});

module.exports = {
  getTree,
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
