import api from '../config/api';

export const chatService = {
  getConversations: () => api.get('/chat/conversations'),

  getUnreadTotal: () => api.get('/chat/unread-total'),

  createConversation: (userId) => api.post('/chat/conversations', { userId }),

  getMessages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),

  markAsRead: (conversationId) =>
    api.post(`/chat/conversations/${conversationId}/read`),

  editMessage: (messageId, content) =>
    api.patch(`/chat/messages/${messageId}`, { content }),
};
