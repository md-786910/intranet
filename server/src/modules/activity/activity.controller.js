const catchAsync = require('../../utils/catchAsync');
const ApiError = require('../../utils/ApiError');
const permissionService = require('../../services/permission.service');
const activityService = require('./activity.service');

// Anyone who manages content in either NEWS or DOCUMENTS can see the
// activity feed (their view is automatically scope-filtered downstream).
async function requireActivityAccess(userId) {
  const [canEditNews, canEditDocs, canCreateNews, canCreateDocs] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'EDIT'),
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'EDIT'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'CREATE'),
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'CREATE'),
  ]);
  if (!canEditNews && !canEditDocs && !canCreateNews && !canCreateDocs) {
    throw ApiError.forbidden('You do not have access to the activity log');
  }
}

const list = catchAsync(async (req, res) => {
  await requireActivityAccess(req.user.user_id);
  const result = await activityService.list(req.query, req.user.user_id);
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { list };
