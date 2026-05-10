const { Server } = require('socket.io');
const socketAuth = require('../middleware/socketAuth');
const corsOptions = require('./cors');
const { getRedisClient } = require('./redis');
const { chatQueue } = require('./bullmq');
const logger = require('./logger');

const ONLINE_SET_KEY = 'bh:online_users';

let io = null;

/**
 * Initialise Socket.IO on the given HTTP server.
 * Returns the io instance.
 */
const initSocketIO = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: corsOptions.origin,
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  // Clear online users on startup
  try {
    const redis = getRedisClient();
    redis.del(ONLINE_SET_KEY).catch((err) => {
      logger.error('Failed to clear online users on startup:', err.message);
    });
  } catch (err) {
    logger.error('Redis client not available for startup cleanup:', err.message);
  }

  // ── Authentication middleware ──
  io.use(socketAuth);

  // ── Connection handler ──
  io.on('connection', async (socket) => {
    const userId = socket.user.user_id;
    const userRoom = `user:${userId}`;

    // Join personal room
    socket.join(userRoom);
    logger.info(`Socket connected: user ${userId} (${socket.id})`);

    // Track online presence
    try {
      const redis = getRedisClient();
      await redis.sadd(ONLINE_SET_KEY, String(userId));
      // Broadcast online status to all connected clients
      socket.broadcast.emit('presence:online', { userId });
    } catch (err) {
      logger.error(`Failed to set online presence for user ${userId}:`, err.message);
    }

    // ── Send message ──
    socket.on('chat:send', async (data, ack) => {
      try {
        const { conversationId, content } = data;
        if (!conversationId || !content?.trim()) {
          return typeof ack === 'function' && ack({ error: 'conversationId and content are required' });
        }

        const chatService = require('../modules/chat/chat.service');
        const message = await chatService.sendMessage(conversationId, userId, content.trim());

        // Send to all participants in the conversation
        const participants = await chatService.getConversationParticipantIds(conversationId);
        participants.forEach((participantId) => {
          io.to(`user:${participantId}`).emit('chat:receive', {
            conversationId,
            message,
          });
        });

        if (typeof ack === 'function') ack({ success: true, message });
      } catch (error) {
        logger.error(`chat:send error (user ${userId}):`, error.message);
        if (typeof ack === 'function') ack({ error: error.message || 'Failed to send message' });
      }
    });

    // ── Typing indicator ──
    socket.on('chat:typing', (data) => {
      try {
        const { conversationId, isTyping } = data;
        if (!conversationId) return;

        // Relay to the other participant(s) — not back to sender
        socket.broadcast.to(`conv:${conversationId}`).emit('chat:typing', {
          conversationId,
          userId,
          isTyping: Boolean(isTyping),
        });
      } catch (error) {
        logger.error(`chat:typing error (user ${userId}):`, error.message);
      }
    });

    // ── Join conversation room (for typing indicators) ──
    socket.on('chat:join', async (data) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        // Verify user is actually a participant
        const chatService = require('../modules/chat/chat.service');
        const isParticipant = await chatService.isUserParticipant(conversationId, userId);
        if (isParticipant) {
          socket.join(`conv:${conversationId}`);
        }
      } catch (error) {
        logger.error(`chat:join error (user ${userId}):`, error.message);
      }
    });

    // ── Leave conversation room ──
    socket.on('chat:leave', (data) => {
      try {
        const { conversationId } = data;
        if (conversationId) {
          socket.leave(`conv:${conversationId}`);
        }
      } catch (error) {
        logger.error(`chat:leave error (user ${userId}):`, error.message);
      }
    });

    // ── Mark as read ──
    socket.on('chat:read', async (data) => {
      try {
        const { conversationId } = data;
        if (!conversationId) return;

        // Enqueue background job via BullMQ
        await chatQueue.add('mark-read', {
          conversationId,
          userId,
        });

        // Notify the other participant that messages were read
        const chatService = require('../modules/chat/chat.service');
        const participants = await chatService.getConversationParticipantIds(conversationId);
        participants
          .filter((pid) => pid !== userId)
          .forEach((pid) => {
            io.to(`user:${pid}`).emit('chat:read', { conversationId, userId });
          });
      } catch (error) {
        logger.error(`chat:read error (user ${userId}):`, error.message);
      }
    });

    // ── Get online users ──
    socket.on('presence:list', async (_, ack) => {
      try {
        const redis = getRedisClient();
        const onlineUserIds = await redis.smembers(ONLINE_SET_KEY);
        if (typeof ack === 'function') ack({ onlineUserIds: onlineUserIds.map(Number) });
      } catch (error) {
        logger.error(`presence:list error (user ${userId}):`, error.message);
        if (typeof ack === 'function') ack({ onlineUserIds: [] });
      }
    });

    // ── Disconnect ──
    socket.on('disconnect', async (reason) => {
      logger.info(`Socket disconnected: user ${userId} (${socket.id}) — ${reason}`);
      try {
        // Check if user has any other active connections
        const sockets = await io.in(userRoom).fetchSockets();
        if (sockets.length === 0) {
          const redis = getRedisClient();
          await redis.srem(ONLINE_SET_KEY, String(userId));

          const lastSeenAt = new Date();
          // Update database
          const { UserAccount } = require('../database/models');
          await UserAccount.update(
            { last_seen_at: lastSeenAt },
            { where: { user_id: userId } }
          ).catch(err => logger.error(`Failed to update last_seen_at for user ${userId}:`, err.message));

          socket.broadcast.emit('presence:offline', { userId, lastSeenAt });
        }
      } catch (err) {
        logger.error(`Failed to clear online presence for user ${userId}:`, err.message);
      }
    });

    // ── Error handler ──
    socket.on('error', (error) => {
      logger.error(`Socket error (user ${userId}):`, error.message);
    });
  });

  logger.info('Socket.IO server attached');
  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialised. Call initSocketIO(server) first.');
  }
  return io;
};

module.exports = { initSocketIO, getIO };
