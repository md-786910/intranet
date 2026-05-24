const catchAsync = require('../../utils/catchAsync');
const service = require('./news-engagement.service');

const like = catchAsync(async (req, res) => {
  const data = await service.addLike(Number(req.params.id), req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

const unlike = catchAsync(async (req, res) => {
  const data = await service.removeLike(Number(req.params.id), req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

const listComments = catchAsync(async (req, res) => {
  const data = await service.listComments(Number(req.params.id), req.user.user_id, req.query);
  res.status(200).json({ status: 'success', data });
});

const addComment = catchAsync(async (req, res) => {
  const data = await service.addComment(Number(req.params.id), req.user.user_id, req.body.body);
  res.status(201).json({ status: 'success', data });
});

const updateComment = catchAsync(async (req, res) => {
  const data = await service.updateComment(
    Number(req.params.id),
    Number(req.params.commentId),
    req.user.user_id,
    req.body.body,
  );
  res.status(200).json({ status: 'success', data });
});

const deleteComment = catchAsync(async (req, res) => {
  const data = await service.deleteComment(
    Number(req.params.id),
    Number(req.params.commentId),
    req.user.user_id,
  );
  res.status(200).json({ status: 'success', data });
});

const share = catchAsync(async (req, res) => {
  const data = await service.recordShare(Number(req.params.id), req.user.user_id, req.body.channel);
  res.status(201).json({ status: 'success', data });
});

const save = catchAsync(async (req, res) => {
  const data = await service.addSave(Number(req.params.id), req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

const unsave = catchAsync(async (req, res) => {
  const data = await service.removeSave(Number(req.params.id), req.user.user_id);
  res.status(200).json({ status: 'success', data });
});

// Admin
const adminEngagementSummary = catchAsync(async (req, res) => {
  const data = await service.adminEngagementSummary(Number(req.params.id));
  res.status(200).json({ status: 'success', data });
});

const adminListLikes = catchAsync(async (req, res) => {
  const data = await service.adminListLikes(Number(req.params.id), req.query);
  res.status(200).json({ status: 'success', data });
});

const adminListComments = catchAsync(async (req, res) => {
  const data = await service.adminListComments(Number(req.params.id), req.query);
  res.status(200).json({ status: 'success', data });
});

const adminListShares = catchAsync(async (req, res) => {
  const data = await service.adminListShares(Number(req.params.id), req.query);
  res.status(200).json({ status: 'success', data });
});

const adminModerateComment = catchAsync(async (req, res) => {
  const data = await service.adminModerateComment(
    Number(req.params.id),
    Number(req.params.commentId),
  );
  res.status(200).json({ status: 'success', data });
});

// Public (no auth)
const publicShare = catchAsync(async (req, res) => {
  const data = await service.getPublicByToken(req.params.token);
  res.status(200).json({ status: 'success', data });
});

module.exports = {
  like,
  unlike,
  listComments,
  addComment,
  updateComment,
  deleteComment,
  share,
  save,
  unsave,
  adminEngagementSummary,
  adminListLikes,
  adminListComments,
  adminListShares,
  adminModerateComment,
  publicShare,
};
