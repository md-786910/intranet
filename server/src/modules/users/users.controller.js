const catchAsync = require('../../utils/catchAsync');
const usersService = require('./users.service');

const list = catchAsync(async (req, res) => {
  const result = await usersService.list(req.query);
  res.status(200).json({ status: 'success', data: result });
});

const getById = catchAsync(async (req, res) => {
  const user = await usersService.getById(req.params.id);
  res.status(200).json({ status: 'success', data: user });
});

const create = catchAsync(async (req, res) => {
  const user = await usersService.create(req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: user });
});

const update = catchAsync(async (req, res) => {
  const user = await usersService.update(req.params.id, req.body, req.user.user_id);
  res.status(200).json({ status: 'success', data: user });
});

const deactivate = catchAsync(async (req, res) => {
  const result = await usersService.deactivate(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const assignRole = catchAsync(async (req, res) => {
  const assignment = await usersService.assignRole(req.params.id, req.body, req.user.user_id);
  res.status(201).json({ status: 'success', data: assignment });
});

const unassignRole = catchAsync(async (req, res) => {
  const result = await usersService.unassignRole(
    req.params.id, req.params.assignmentId, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: result });
});

const assignDepartment = catchAsync(async (req, res) => {
  const membership = await usersService.assignDepartment(
    req.params.id, req.body, req.user.user_id
  );
  res.status(201).json({ status: 'success', data: membership });
});

const removeDepartment = catchAsync(async (req, res) => {
  const result = await usersService.removeDepartment(req.params.id, req.params.deptId);
  res.status(200).json({ status: 'success', data: result });
});

const assignDirectPermission = catchAsync(async (req, res) => {
  const permission = await usersService.assignDirectPermission(
    req.params.id, req.body, req.user.user_id
  );
  res.status(201).json({ status: 'success', data: permission });
});

const removeDirectPermission = catchAsync(async (req, res) => {
  const result = await usersService.removeDirectPermission(
    req.params.id, req.params.permissionId, req.user.user_id
  );
  res.status(200).json({ status: 'success', data: result });
});

const importCsv = catchAsync(async (req, res) => {
  const result = await usersService.importCsv(req.body.users, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const resendInvite = catchAsync(async (req, res) => {
  const result = await usersService.resendInvite(req.params.id, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

const listChatCandidates = catchAsync(async (req, res) => {
  const candidates = await usersService.listChatCandidates();
  res.status(200).json({ status: 'success', data: candidates });
});

const getOrgChain = catchAsync(async (req, res) => {
  const data = await usersService.getOrgChain(Number(req.params.id));
  res.status(200).json({ status: 'success', data });
});

module.exports = {
  list,
  getById,
  create,
  update,
  deactivate,
  assignRole,
  unassignRole,
  assignDirectPermission,
  removeDirectPermission,
  assignDepartment,
  removeDepartment,
  importCsv,
  resendInvite,
  listChatCandidates,
  getOrgChain,
};
