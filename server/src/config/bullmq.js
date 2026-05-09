const { Queue, Worker } = require('bullmq');
const Redis = require('ioredis');
const logger = require('./logger');

// BullMQ requires its own Redis connection WITHOUT keyPrefix
// (it manages its own key namespacing internally)
const createBullConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: null, // Required by BullMQ
});

// ── Chat Queue ──
const chatQueue = new Queue('chat', {
  connection: createBullConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

chatQueue.on('error', (err) => {
  logger.error('BullMQ chat queue error:', err.message);
});

// ── Chat Worker ──
let chatWorker = null;

const startChatWorker = () => {
  chatWorker = new Worker('chat', async (job) => {
    try {
      switch (job.name) {
        case 'mark-read': {
          const { ConversationParticipant } = require('../database/models');
          const { conversationId, userId } = job.data;
          await ConversationParticipant.update(
            { last_read_at: new Date() },
            { where: { conversation_id: conversationId, user_id: userId } },
          );
          logger.debug(`Marked conversation ${conversationId} as read for user ${userId}`);
          break;
        }

        case 'notify': {
          // Stub for future push notification integration
          logger.debug('Notification job received (stub):', job.data);
          break;
        }

        default:
          logger.warn(`Unknown chat job type: ${job.name}`);
      }
    } catch (error) {
      logger.error(`Chat worker job ${job.name} failed:`, error.message);
      throw error; // Re-throw so BullMQ retries
    }
  }, {
    connection: createBullConnection(),
    concurrency: 5,
  });

  chatWorker.on('completed', (job) => {
    logger.debug(`Chat job ${job.name} [${job.id}] completed`);
  });

  chatWorker.on('failed', (job, err) => {
    logger.error(`Chat job ${job?.name} [${job?.id}] failed: ${err.message}`);
  });

  chatWorker.on('error', (err) => {
    logger.error('BullMQ chat worker error:', err.message);
  });

  chatWorker.on('stalled', (jobId) => {
    logger.warn(`Chat job ${jobId} stalled`);
  });

  logger.info('BullMQ chat worker started');
  return chatWorker;
};

const shutdownBullMQ = async () => {
  try {
    if (chatWorker) {
      await chatWorker.close();
      logger.info('BullMQ chat worker closed');
    }
    await chatQueue.close();
    logger.info('BullMQ chat queue closed');
  } catch (err) {
    logger.error('Error shutting down BullMQ:', err.message);
  }
};

module.exports = { chatQueue, startChatWorker, shutdownBullMQ };
