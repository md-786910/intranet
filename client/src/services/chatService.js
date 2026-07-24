import api from '../config/api';

export const chatService = {
  createConversation: (userId) => api.post('/chat/conversations', { userId }),

  getMessages: (conversationId, params) =>
    api.get(`/chat/conversations/${conversationId}/messages`, { params }),

  markAsRead: (conversationId) =>
    api.post(`/chat/conversations/${conversationId}/read`),
};
