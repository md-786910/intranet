const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const audienceService = require('../../services/audience.service');
const logger = require('../../config/logger');

// Build the wire payload a client expects on the bell + on the
// `notification:new` socket event. Kept in one place so reader and writer
// paths emit the same shape.
function toWire(row) {
  return {
    notification_id: row.notification_id,
    type: row.type,
    entity_id: row.entity_id,
    title: row.title,
    body: row.body,
    read_at: row.read_at,
    created_at: row.created_at,
  };
}

// ─── Reader API ──────────────────────────────────────────────────────────────

async function list(userId, { limit = 20, before } = {}) {
  const { Notification } = require('../../database/models');
  const where = { user_id: userId };
  if (before) where.created_at = { [Op.lt]: new Date(before) };
  const rows = await Notification.findAll({
    where,
    order: [['created_at', 'DESC']],
    limit,
  });
  return rows.map(toWire);
}

async function getUnreadCount(userId) {
  const { Notification } = require('../../database/models');
  const count = await Notification.count({
    where: { user_id: userId, read_at: null },
  });
  return { count };
}

async function markRead(id, userId) {
  const { Notification } = require('../../database/models');
  const row = await Notification.findOne({
    where: { notification_id: id, user_id: userId },
  });
  if (!row) throw ApiError.notFound('Notification not found');
  if (!row.read_at) {
    row.read_at = new Date();
    await row.save();
  }
  return toWire(row);
}

async function markAllRead(userId) {
  const { Notification } = require('../../database/models');
  const now = new Date();
  const [updated] = await Notification.update(
    { read_at: now },
    { where: { user_id: userId, read_at: null } },
  );
  return { updated };
}

// ─── Writer API (publish hooks) ──────────────────────────────────────────────

// Fan a new published item out to every user the audience rules entitle to
// see it. Persists one row per recipient (source of truth for offline users)
// and emits a live `notification:new` to each recipient's `user:<id>` room
// (instant UX for online users).
//
// Audience semantics are delegated to audienceService.getRecipientUserIds,
// which honours the ORG → OFFICE_LOCATION → VERTICAL → DEPARTMENT hierarchy
// using the same logic that gates the visibility list endpoints.
//
// `entity` keys map to server/src/config/visibility.config.js — pass 'news'
// or 'documents' so per-entity audienceLevels / minLevel is honoured.
// Tries to emit `event` to user `userId`'s personal socket room. Never throws.
function safeEmit(io, userId, event, payload) {
  if (!io) return;
  try {
    io.to(`user:${userId}`).emit(event, payload);
  } catch (err) {
    logger.error(`Failed to emit ${event} to user ${userId}: ${err.message}`);
  }
}

async function notifyOnPublish({ type, entity, audienceRules, entityKey }) {
  try {
    const { Notification } = require('../../database/models');
    const { getIO } = require('../../config/socket');

    const recipientIds = await audienceService.getRecipientUserIds(
      audienceRules,
      entityKey,
    );

    logger.info(
      `Fanning notification — type=${type} entityId=${entity.id} recipients=${recipientIds.length}`,
    );
    if (recipientIds.length === 0) return { sent: 0, nudged: 0 };

    // Find rows that already exist for these recipients on this entity. The
    // DB has a unique (user_id, type, entity_id) constraint, so re-fanning to
    // a user who already has a row doesn't create a duplicate — they get a
    // live `notification:nudge` toast instead of a fresh bell entry.
    const existing = await Notification.findAll({
      where: { type, entity_id: entity.id, user_id: { [Op.in]: recipientIds } },
    });
    const existingByUser = new Map(existing.map((row) => [row.user_id, row]));

    const newUserIds = recipientIds.filter((uid) => !existingByUser.has(uid));
    const title = entity.title;
    const body = (entity.summary || '').slice(0, 500) || null;

    let inserted = [];
    if (newUserIds.length > 0) {
      const rows = newUserIds.map((uid) => ({
        tenant_id: DEFAULT_TENANT_ID,
        user_id: uid,
        type,
        entity_id: entity.id,
        title,
        body,
      }));
      inserted = await Notification.bulkCreate(rows, { returning: true });
    }

    let io = null;
    try {
      io = getIO();
    } catch (err) {
      logger.warn('Socket.IO not available — skipping live notification emit');
    }

    // Fresh delivery → adds to bell + bumps badge + toast on the client.
    inserted.forEach((row) => {
      safeEmit(io, row.user_id, 'notification:new', { notification: toWire(row) });
    });

    // Re-notify → toast only. The bell row already exists; we don't want it
    // to multiply or re-flag itself as unread.
    existing.forEach((row) => {
      safeEmit(io, row.user_id, 'notification:nudge', { notification: toWire(row) });
    });

    return { sent: inserted.length, nudged: existing.length };
  } catch (err) {
    // Caller invokes us as a side effect of publish — never let our failure
    // bubble up and undo the publish. Log loudly so issues surface.
    logger.error(
      `notifyOnPublish failed — type=${type} entityKey=${entityKey} entityId=${entity?.id}: ${err.message}`,
      err,
    );
    return { sent: 0, nudged: 0, error: err.message };
  }
}

module.exports = {
  list,
  getUnreadCount,
  markRead,
  markAllRead,
  notifyOnPublish,
};
