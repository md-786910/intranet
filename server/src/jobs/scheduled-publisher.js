'use strict';

// Periodic scheduled-content publisher.
// Industry-standard CMS pattern (WordPress wp-cron, Ghost, Drupal cron):
// every minute, scan each content table for rows where status='SCHEDULED' and
// scheduled_at has elapsed, then publish them via the same service method the
// manual "Publish" button uses. Audit log, audience fan-out, and push-notify
// behavior therefore match scheduled publishes to manual ones exactly.

const { Op } = require('sequelize');
const logger = require('../config/logger');

const INTERVAL_MS = 60 * 1000;
const BATCH_LIMIT = 50;

let timer = null;
let running = false;

async function processQueue(cfg, now) {
  const { Model, service, idField, label } = cfg;
  const due = await Model.findAll({
    where: { status: 'SCHEDULED', scheduled_at: { [Op.lte]: now } },
    order: [['scheduled_at', 'ASC']],
    limit: BATCH_LIMIT,
  });

  if (due.length > 0) {
    logger.info(`[scheduled-publisher] ${label}: ${due.length} due item(s) at ${now.toISOString()}`);
  }

  for (const row of due) {
    const id = row[idField];
    try {
      // Falls back to author_id if scheduled_by is missing (e.g. legacy row).
      const actorId = row.scheduled_by || row.author_id;
      await service.publish(id, actorId);
      logger.info(`[scheduled-publisher] published ${label} ${id}`);
    } catch (err) {
      logger.error(`[scheduled-publisher] ${label} ${id} failed: ${err.stack || err.message}`);
    }
  }
}

async function tick() {
  if (running) return; // overlap guard
  running = true;
  try {
    const {
      NewsItem,
      AnnouncementItem,
      DocumentItem,
    } = require('../database/models');
    const newsService = require('../modules/news/news.service');
    const announcementsService = require('../modules/announcements/announcements.service');
    const documentsService = require('../modules/documents/documents.service');

    const now = new Date();
    const configs = [
      { Model: NewsItem, service: newsService, idField: 'news_item_id', label: 'NEWS' },
      { Model: AnnouncementItem, service: announcementsService, idField: 'announcement_item_id', label: 'ANNOUNCEMENT' },
      { Model: DocumentItem, service: documentsService, idField: 'document_item_id', label: 'DOCUMENT' },
    ];

    for (const cfg of configs) {
      try {
        await processQueue(cfg, now);
      } catch (err) {
        logger.error(`[scheduled-publisher] queue ${cfg.label} failed: ${err.message}`);
      }
    }
  } finally {
    running = false;
  }
}

function start() {
  if (timer) return;
  timer = setInterval(() => {
    tick().catch((err) => logger.error('[scheduled-publisher] tick crashed', err));
  }, INTERVAL_MS);
  // Kick once on boot so a restart doesn't delay due items by up to a minute.
  tick().catch(() => {});
  logger.info(`[scheduled-publisher] started, polling every ${INTERVAL_MS / 1000}s`);
}

function stop() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

module.exports = { start, stop };
