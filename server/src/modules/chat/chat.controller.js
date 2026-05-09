const catchAsync = require('../../utils/catchAsync');
const chatService = require('./chat.service');

const getConversations = catchAsync(async (req, res) => {
  const conversations = await chatService.getConversations(req.user.user_id);
  res.status(200).json({ status: 'success', data: conversations });
});

const createConversation = catchAsync(async (req, res) => {
  const conversation = await chatService.getOrCreateConversation(
    req.user.user_id,
    req.body.userId,
  );
  res.status(200).json({ status: 'success', data: conversation });
});

const getMessages = catchAsync(async (req, res) => {
  const result = await chatService.getMessages(
    parseInt(req.params.id, 10),
    req.user.user_id,
    req.query,
  );
  res.status(200).json({ status: 'success', data: result });
});

const markAsRead = catchAsync(async (req, res) => {
  const result = await chatService.markAsRead(
    parseInt(req.params.id, 10),
    req.user.user_id,
  );
  res.status(200).json({ status: 'success', data: result });
});

const getContacts = catchAsync(async (req, res) => {
  const contacts = await chatService.getContacts(req.user.user_id, req.query);
  res.status(200).json({ status: 'success', data: contacts });
});

module.exports = {
  getConversations,
  createConversation,
  getMessages,
  markAsRead,
  getContacts,
};
