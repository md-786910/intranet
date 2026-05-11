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
async function notifyOnPublish({ type, entity, audienceRules, entityKey }) {
  try {
    const { Notification } = require('../../database/models');
    const { getIO } = require('../../config/socket');

    const recipientIds = await audienceService.getRecipientUserIds(
      audienceRules,
      entityKey,
    );

    // Always log the fan-out outcome — operationally we need to see success
    // counts, not just failures. Includes context for grep-friendly diagnosis.
    logger.info(
      `Fanning notification — type=${type} entityId=${entity.id} recipients=${recipientIds.length}`,
    );
    if (recipientIds.length === 0) return { sent: 0 };

    const title = entity.title;
    const body = (entity.summary || '').slice(0, 500) || null;

    const rows = recipientIds.map((uid) => ({
      tenant_id: DEFAULT_TENANT_ID,
      user_id: uid,
      type,
      entity_id: entity.id,
      title,
      body,
    }));

    const created = await Notification.bulkCreate(rows, { returning: true });

    // Emit to each recipient's personal socket room. Failures here are
    // logged but never thrown — the DB row is the durable source of truth,
    // so the user will still see it on their next portal load.
    let io;
    try {
      io = getIO();
    } catch (err) {
      logger.warn('Socket.IO not available — skipping live notification emit');
      io = null;
    }
    if (io) {
      created.forEach((row) => {
        try {
          io.to(`user:${row.user_id}`).emit('notification:new', {
            notification: toWire(row),
          });
        } catch (err) {
          logger.error(
            `Failed to emit notification:new to user ${row.user_id}: ${err.message}`,
          );
        }
      });
    }

    return { sent: created.length };
  } catch (err) {
    // Caller invokes us as a side effect of publish — never let our failure
    // bubble up and undo the publish. Log loudly so issues surface.
    logger.error(
      `notifyOnPublish failed — type=${type} entityKey=${entityKey} entityId=${entity?.id}: ${err.message}`,
      err,
    );
    return { sent: 0, error: err.message };
  }
}

module.exports = {
  list,
  getUnreadCount,
  markRead,
  markAllRead,
  notifyOnPublish,
};
