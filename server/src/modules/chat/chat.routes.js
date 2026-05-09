const router = require('express').Router();
const controller = require('./chat.controller');
const authenticate = require('../../middleware/authenticate');
const validate = require('../../middleware/validate');
const schemas = require('./chat.validation');

router.use(authenticate);

// Get all conversations for the logged-in user
router.get('/conversations', controller.getConversations);

// Create or get a conversation with another user
router.post(
  '/conversations',
  validate(schemas.createConversationSchema),
  controller.createConversation,
);

// Get paginated messages for a conversation
router.get(
  '/conversations/:id/messages',
  validate(schemas.getMessagesSchema),
  controller.getMessages,
);

// Mark a conversation as read
router.post(
  '/conversations/:id/read',
  validate(schemas.markAsReadSchema),
  controller.markAsRead,
);

// Get contacts from user's vertical (for starting new chats)
router.get(
  '/contacts',
  validate(schemas.getContactsSchema),
  controller.getContacts,
);

module.exports = router;
