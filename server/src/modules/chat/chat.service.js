const { Op, fn, col, literal } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const chatService = {
  /**
   * Get or create a 1:1 conversation between two users.
   */
  async getOrCreateConversation(userId1, userId2) {
    const {
      Conversation, ConversationParticipant, UserAccount, PersonProfile, sequelize,
    } = require('../../database/models');

    if (userId1 === userId2) {
      throw ApiError.badRequest('Cannot create a conversation with yourself');
    }

    // Check that the target user exists and is active
    const targetUser = await UserAccount.findOne({
      where: { user_id: userId2, deleted_at: null, status: 'ACTIVE' },
    });
    if (!targetUser) throw ApiError.notFound('User not found');

    // Find existing conversation where both users are participants
    const existing = await sequelize.query(`
      SELECT cp1.conversation_id
      FROM conversation_participant cp1
      JOIN conversation_participant cp2
        ON cp1.conversation_id = cp2.conversation_id
      WHERE cp1.user_id = :userId1
        AND cp2.user_id = :userId2
      LIMIT 1
    `, {
      replacements: { userId1, userId2 },
      type: sequelize.QueryTypes.SELECT,
    });

    if (existing.length > 0) {
      const conversationId = existing[0].conversation_id;
      return this._hydrateConversation(conversationId, userId1);
    }

    // Create new conversation
    const transaction = await sequelize.transaction();
    try {
      const conversation = await Conversation.create(
        { created_by: userId1 },
        { transaction },
      );

      await ConversationParticipant.bulkCreate([
        { conversation_id: conversation.id, user_id: userId1, last_read_at: new Date() },
        { conversation_id: conversation.id, user_id: userId2 },
      ], { transaction });

      await transaction.commit();
      return this._hydrateConversation(conversation.id, userId1);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  /**
   * Send a message in a conversation.
   */
  async sendMessage(conversationId, senderId, content) {
    const { ChatMessage, ConversationParticipant, Conversation, UserAccount } = require('../../database/models');

    // Verify sender is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversation_id: conversationId, user_id: senderId },
    });
    if (!participant) throw ApiError.forbidden('You are not a participant of this conversation');

    // Verify conversation exists
    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw ApiError.notFound('Conversation not found');

    // Create message
    const message = await ChatMessage.create({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: 'TEXT',
    });

    // Update conversation's updated_at (for ordering)
    await conversation.update({ updated_at: new Date() });

    // Update sender's last_read_at
    await participant.update({ last_read_at: new Date() });

    // Hydrate with sender info
    const sender = await UserAccount.findByPk(senderId, {
      attributes: ['user_id', 'first_name', 'last_name', 'avatar_url'],
    });

    return {
      id: message.id,
      conversationId: message.conversation_id,
      senderId: message.sender_id,
      content: message.content,
      messageType: message.message_type,
      createdAt: message.created_at,
      sender: sender ? {
        userId: sender.user_id,
        firstName: sender.first_name,
        lastName: sender.last_name,
        avatarUrl: sender.avatar_url,
      } : null,
    };
  },

  /**
   * Get all conversations for a user with last message preview.
   */
  async getConversations(userId) {
    const {
      ConversationParticipant, Conversation, ChatMessage, UserAccount, PersonProfile, sequelize,
    } = require('../../database/models');

    // Get all conversation IDs for this user
    const participations = await ConversationParticipant.findAll({
      where: { user_id: userId },
      attributes: ['conversation_id', 'last_read_at'],
    });

    if (participations.length === 0) return [];

    const convIds = participations.map((p) => p.conversation_id);
    const lastReadMap = new Map(participations.map((p) => [p.conversation_id, p.last_read_at]));

    // Get conversations with the other participant's info
    const conversations = await Promise.all(
      convIds.map(async (convId) => {
        // Get the other participant
        const otherParticipant = await ConversationParticipant.findOne({
          where: {
            conversation_id: convId,
            user_id: { [Op.ne]: userId },
          },
          include: [{
            model: UserAccount,
            as: 'user',
            attributes: ['user_id', 'first_name', 'last_name', 'avatar_url', 'status', 'last_seen_at'],
            include: [{
              model: PersonProfile,
              as: 'profile',
              attributes: ['job_title'],
              required: false,
            }],
          }],
        });

        // Get last message
        const lastMessage = await ChatMessage.findOne({
          where: { conversation_id: convId },
          order: [['created_at', 'DESC']],
          attributes: ['id', 'content', 'sender_id', 'created_at'],
        });

        // Count unread messages
        const lastReadAt = lastReadMap.get(convId);
        let unreadCount = 0;
        if (lastReadAt) {
          unreadCount = await ChatMessage.count({
            where: {
              conversation_id: convId,
              sender_id: { [Op.ne]: userId },
              created_at: { [Op.gt]: lastReadAt },
            },
          });
        } else {
          unreadCount = await ChatMessage.count({
            where: {
              conversation_id: convId,
              sender_id: { [Op.ne]: userId },
            },
          });
        }

        const other = otherParticipant?.user;
        return {
          id: convId,
          otherUser: other ? {
            userId: other.user_id,
            firstName: other.first_name,
            lastName: other.last_name,
            avatarUrl: other.avatar_url,
            jobTitle: other.profile?.job_title || null,
            lastSeenAt: other.last_seen_at,
          } : null,
          lastMessage: lastMessage ? {
            id: lastMessage.id,
            content: lastMessage.content,
            senderId: lastMessage.sender_id,
            createdAt: lastMessage.created_at,
          } : null,
          unreadCount,
          updatedAt: lastMessage?.created_at || null,
        };
      }),
    );

    // Sort by last message time (newest first), conversations without messages at the end
    return conversations
      .filter((c) => c.otherUser) // Skip orphaned conversations
      .sort((a, b) => {
        if (!a.updatedAt && !b.updatedAt) return 0;
        if (!a.updatedAt) return 1;
        if (!b.updatedAt) return -1;
        return new Date(b.updatedAt) - new Date(a.updatedAt);
      });
  },

  /**
   * Get paginated messages for a conversation.
   */
  async getMessages(conversationId, userId, query = {}) {
    const { ChatMessage, ConversationParticipant, UserAccount } = require('../../database/models');

    // Verify user is a participant
    const participant = await ConversationParticipant.findOne({
      where: { conversation_id: conversationId, user_id: userId },
    });
    if (!participant) throw ApiError.forbidden('You are not a participant of this conversation');

    const { page, limit, offset } = parsePagination(query);

    const { count, rows } = await ChatMessage.findAndCountAll({
      where: { conversation_id: conversationId },
      include: [{
        model: UserAccount,
        as: 'sender',
        attributes: ['user_id', 'first_name', 'last_name', 'avatar_url'],
      }],
      order: [['created_at', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    });

    const messages = rows.map((m) => ({
      id: m.id,
      conversationId: m.conversation_id,
      senderId: m.sender_id,
      content: m.content,
      messageType: m.message_type,
      createdAt: m.created_at,
      sender: m.sender ? {
        userId: m.sender.user_id,
        firstName: m.sender.first_name,
        lastName: m.sender.last_name,
        avatarUrl: m.sender.avatar_url,
      } : null,
    }));

    return {
      messages: messages.reverse(), // Return in chronological order
      pagination: buildPagination(page, limit, count),
    };
  },

  /**
   * Mark conversation as read for a user.
   */
  async markAsRead(conversationId, userId) {
    const { ConversationParticipant } = require('../../database/models');
    await ConversationParticipant.update(
      { last_read_at: new Date() },
      { where: { conversation_id: conversationId, user_id: userId } },
    );
    return { success: true };
  },

  /**
   * Get contacts from the user's vertical (reuses org.service pattern).
   */
  async getContacts(userId, { search, limit: rawLimit } = {}) {
    const {
      UserAccount, PersonProfile, DepartmentMembership, Department, Vertical,
    } = require('../../database/models');

    const contactLimit = Math.min(parseInt(rawLimit, 10) || 50, 100);

    // Find user's vertical
    const membership = await DepartmentMembership.findOne({
      where: { user_id: userId },
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC']],
      include: [{
        model: Department,
        as: 'department',
        where: { deleted_at: null },
        required: true,
        include: [{
          model: Vertical,
          as: 'vertical',
          where: { deleted_at: null },
          required: true,
        }],
      }],
    });

    if (!membership || !membership.department?.vertical) {
      return [];
    }

    const verticalId = membership.department.vertical.id;

    // Get all department IDs in this vertical
    const departments = await Department.findAll({
      where: { vertical_id: verticalId, deleted_at: null },
      attributes: ['id'],
    });
    const deptIds = departments.map((d) => d.id);
    if (deptIds.length === 0) return [];

    // Build search conditions
    const userWhere = {
      deleted_at: null,
      status: 'ACTIVE',
      user_id: { [Op.ne]: userId },
    };

    if (search) {
      userWhere[Op.or] = [
        { first_name: { [Op.iLike]: `%${search}%` } },
        { last_name: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
      ];
    }

    const users = await UserAccount.findAll({
      where: userWhere,
      attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url', 'last_seen_at'],
      include: [
        { model: PersonProfile, as: 'profile', required: false },
        {
          model: DepartmentMembership,
          as: 'departmentMemberships',
          required: true,
          where: { department_id: deptIds },
          include: [{
            model: Department,
            as: 'department',
            attributes: ['id', 'name'],
            required: true,
          }],
        },
      ],
      order: [['first_name', 'ASC'], ['last_name', 'ASC']],
      subQuery: false,
      limit: contactLimit,
    });

    return users.map((u) => {
      const primary = (u.departmentMemberships || []).find((m) => m.is_primary)
        || (u.departmentMemberships || [])[0];
      return {
        userId: u.user_id,
        firstName: u.first_name,
        lastName: u.last_name,
        email: u.email,
        avatarUrl: u.avatar_url || null,
        jobTitle: u.profile?.job_title || null,
        lastSeenAt: u.last_seen_at,
        departmentName: primary?.department?.name || null,
      };
    });
  },

  /**
   * Get participant user IDs for a conversation.
   */
  async getConversationParticipantIds(conversationId) {
    const { ConversationParticipant } = require('../../database/models');
    const participants = await ConversationParticipant.findAll({
      where: { conversation_id: conversationId },
      attributes: ['user_id'],
    });
    return participants.map((p) => p.user_id);
  },

  /**
   * Check if a user is a participant of a conversation.
   */
  async isUserParticipant(conversationId, userId) {
    const { ConversationParticipant } = require('../../database/models');
    const participant = await ConversationParticipant.findOne({
      where: { conversation_id: conversationId, user_id: userId },
      attributes: ['id'],
    });
    return Boolean(participant);
  },

  /**
   * Hydrate a conversation with participant info for a specific user.
   */
  async _hydrateConversation(conversationId, userId) {
    const {
      ConversationParticipant, Conversation, ChatMessage, UserAccount, PersonProfile,
    } = require('../../database/models');

    const conversation = await Conversation.findByPk(conversationId);
    if (!conversation) throw ApiError.notFound('Conversation not found');

    // Get the other participant
    const otherParticipant = await ConversationParticipant.findOne({
      where: {
        conversation_id: conversationId,
        user_id: { [Op.ne]: userId },
      },
      include: [{
        model: UserAccount,
        as: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'avatar_url', 'status', 'last_seen_at'],
        include: [{
          model: PersonProfile,
          as: 'profile',
          attributes: ['job_title'],
          required: false,
        }],
      }],
    });

    // Get last message
    const lastMessage = await ChatMessage.findOne({
      where: { conversation_id: conversationId },
      order: [['created_at', 'DESC']],
      attributes: ['id', 'content', 'sender_id', 'created_at'],
    });

    const other = otherParticipant?.user;
    return {
      id: conversationId,
      otherUser: other ? {
        userId: other.user_id,
        firstName: other.first_name,
        lastName: other.last_name,
        avatarUrl: other.avatar_url,
        jobTitle: other.profile?.job_title || null,
        lastSeenAt: other.last_seen_at,
      } : null,
      lastMessage: lastMessage ? {
        id: lastMessage.id,
        content: lastMessage.content,
        senderId: lastMessage.sender_id,
        createdAt: lastMessage.created_at,
      } : null,
      unreadCount: 0,
      updatedAt: lastMessage?.created_at || conversation.created_at,
    };
  },
};

module.exports = chatService;
