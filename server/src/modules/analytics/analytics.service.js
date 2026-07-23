const { QueryTypes } = require('sequelize');
const cacheService = require('../../services/cache.service');

const analyticsService = {
  async getDashboard() {
    const { sequelize } = require('../../database/models');

    const cacheKey = 'bh:analytics:dashboard';
    const cached = await cacheService.get(cacheKey);
    if (cached) return JSON.parse(cached);

    const [userStats] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'ACTIVE' AND deleted_at IS NULL) AS active_users,
        COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_users
      FROM user_account
    `, { type: QueryTypes.SELECT });

    const [orgStats] = await sequelize.query(`
      SELECT
        (SELECT COUNT(*) FROM office_location WHERE deleted_at IS NULL) AS office_locations,
        (SELECT COUNT(*) FROM vertical WHERE deleted_at IS NULL) AS verticals,
        (SELECT COUNT(*) FROM department WHERE deleted_at IS NULL) AS departments
    `, { type: QueryTypes.SELECT });

    // News stats - table may not exist yet, handle gracefully
    let newsStats = { total: 0, published: 0, draft: 0 };
    try {
      const [ns] = await sequelize.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published,
          COUNT(*) FILTER (WHERE status = 'DRAFT') AS draft
        FROM news_item
        WHERE deleted_at IS NULL
      `, { type: QueryTypes.SELECT });
      newsStats = ns;
    } catch (e) { /* table may not exist yet */ }

    // Document stats
    let docStats = { total: 0, published: 0 };
    try {
      const [ds] = await sequelize.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published
        FROM document_item
        WHERE deleted_at IS NULL
      `, { type: QueryTypes.SELECT });
      docStats = ds;
    } catch (e) { /* table may not exist yet */ }

    // Push stats
    let pushStats = { total: 0, sent: 0 };
    try {
      const [ps] = await sequelize.query(`
        SELECT
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'SENT') AS sent
        FROM push_campaign
        WHERE deleted_at IS NULL
      `, { type: QueryTypes.SELECT });
      pushStats = ps;
    } catch (e) { /* table may not exist yet */ }

    const result = {
      users: userStats,
      organisation: orgStats,
      news: newsStats,
      documents: docStats,
      push: pushStats,
    };

    await cacheService.set(cacheKey, JSON.stringify(result), 120);
    return result;
  },

  async getContentMetrics(query) {
    const { sequelize } = require('../../database/models');

    let newsOverTime = [];
    try {
      newsOverTime = await sequelize.query(`
        SELECT
          date_trunc(:granularity, created_at) AS period,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published
        FROM news_item
        WHERE deleted_at IS NULL
          AND (:start_date::date IS NULL OR created_at >= :start_date::date)
          AND (:end_date::date IS NULL OR created_at <= :end_date::date)
        GROUP BY period
        ORDER BY period DESC
        LIMIT 52
      `, {
        replacements: {
          granularity: query.granularity || 'week',
          start_date: query.start_date || null,
          end_date: query.end_date || null,
        },
        type: QueryTypes.SELECT,
      });
    } catch (e) { /* table may not exist yet */ }

    let docsOverTime = [];
    try {
      docsOverTime = await sequelize.query(`
        SELECT
          date_trunc(:granularity, created_at) AS period,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status = 'PUBLISHED') AS published
        FROM document_item
        WHERE deleted_at IS NULL
          AND (:start_date::date IS NULL OR created_at >= :start_date::date)
          AND (:end_date::date IS NULL OR created_at <= :end_date::date)
        GROUP BY period
        ORDER BY period DESC
        LIMIT 52
      `, {
        replacements: {
          granularity: query.granularity || 'week',
          start_date: query.start_date || null,
          end_date: query.end_date || null,
        },
        type: QueryTypes.SELECT,
      });
    } catch (e) { /* table may not exist yet */ }

    return { news: newsOverTime, documents: docsOverTime };
  },

  async getUserMetrics(query) {
    const { sequelize } = require('../../database/models');

    const userGrowth = await sequelize.query(`
      SELECT
        date_trunc(:granularity, created_at) AS period,
        COUNT(*) AS new_users
      FROM user_account
      WHERE deleted_at IS NULL
        AND (:start_date::date IS NULL OR created_at >= :start_date::date)
        AND (:end_date::date IS NULL OR created_at <= :end_date::date)
      GROUP BY period
      ORDER BY period DESC
      LIMIT 52
    `, {
      replacements: {
        granularity: query.granularity || 'week',
        start_date: query.start_date || null,
        end_date: query.end_date || null,
      },
      type: QueryTypes.SELECT,
    });

    const loginActivity = await sequelize.query(`
      SELECT
        date_trunc(:granularity, created_at) AS period,
        COUNT(*) AS logins
      FROM audit_log
      WHERE action = 'USER_LOGIN'
        AND (:start_date::date IS NULL OR created_at >= :start_date::date)
        AND (:end_date::date IS NULL OR created_at <= :end_date::date)
      GROUP BY period
      ORDER BY period DESC
      LIMIT 52
    `, {
      replacements: {
        granularity: query.granularity || 'week',
        start_date: query.start_date || null,
        end_date: query.end_date || null,
      },
      type: QueryTypes.SELECT,
    });

    return { userGrowth, loginActivity };
  },

  async getPushMetrics(query) {
    const { sequelize } = require('../../database/models');

    let campaignStats = [];
    try {
      campaignStats = await sequelize.query(`
        SELECT
          status,
          COUNT(*) AS count,
          COALESCE(SUM(recipient_count), 0) AS total_recipients
        FROM push_campaign
        WHERE deleted_at IS NULL
          AND (:start_date::date IS NULL OR created_at >= :start_date::date)
          AND (:end_date::date IS NULL OR created_at <= :end_date::date)
        GROUP BY status
      `, {
        replacements: {
          start_date: query.start_date || null,
          end_date: query.end_date || null,
        },
        type: QueryTypes.SELECT,
      });
    } catch (e) { /* table may not exist yet */ }

    return { campaignStats };
  },

  /**
   * Content Manager workspace: period publish stats, daily series, recent publishes.
   * Scoped via scope-visibility (same rules as content list pages).
   */
  async getContentWorkspace(query, userId) {
    const { sequelize } = require('../../database/models');
    const permissionService = require('../../services/permission.service');
    const scopeVisibilityService = require('../../services/scope-visibility.service');

    const periodKey = query.period || '7d';
    const typeFilter = query.type || 'all';
    const { start, end } = resolveWorkspacePeriod(periodKey);

    const [canNews, canDocs] = await Promise.all([
      permissionService.hasPermissionAnywhere(userId, 'NEWS', 'VIEW'),
      permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'VIEW'),
    ]);
    // Announcements share NEWS:VIEW in this app
    const canAnnouncements = canNews;

    const includeNews = canNews && (typeFilter === 'all' || typeFilter === 'news');
    const includeDocs = canDocs && (typeFilter === 'all' || typeFilter === 'documents');
    const includeAnnouncements = canAnnouncements && (typeFilter === 'all' || typeFilter === 'announcements');

    const [newsKeys, docKeys] = await Promise.all([
      includeNews || includeAnnouncements
        ? scopeVisibilityService.getReadableScopeKeys(userId, 'NEWS')
        : Promise.resolve([]),
      includeDocs
        ? scopeVisibilityService.getReadableScopeKeys(userId, 'DOCUMENTS')
        : Promise.resolve([]),
    ]);

    const emptyStatus = { published: 0, draft: 0, scheduled: 0 };
    const stats = {
      news: { ...emptyStatus },
      documents: { published: 0, draft: 0 },
      announcements: { published: 0, draft: 0 },
      published_total: 0,
    };

    if (includeNews) {
      stats.news = await countContentStatuses(sequelize, {
        table: 'news_item',
        idCol: 'news_item_id',
        scopeKeys: newsKeys,
        start,
        end,
        withScheduled: true,
      });
    }
    if (includeDocs) {
      const docStats = await countContentStatuses(sequelize, {
        table: 'document_item',
        idCol: 'document_item_id',
        scopeKeys: docKeys,
        start,
        end,
        withScheduled: false,
      });
      stats.documents = { published: docStats.published, draft: docStats.draft };
    }
    if (includeAnnouncements) {
      const annStats = await countContentStatuses(sequelize, {
        table: 'announcement_item',
        idCol: 'announcement_item_id',
        scopeKeys: newsKeys,
        start,
        end,
        withScheduled: true,
      });
      stats.announcements = {
        published: annStats.published,
        draft: annStats.draft,
        scheduled: annStats.scheduled,
      };
    }

    stats.published_total = stats.news.published
      + stats.documents.published
      + stats.announcements.published;

    const series = await buildPublishSeries(sequelize, {
      start,
      end,
      includeNews,
      includeDocs,
      includeAnnouncements,
      newsKeys,
      docKeys,
    });

    const recent = await fetchRecentPublished(sequelize, {
      includeNews,
      includeDocs,
      includeAnnouncements,
      newsKeys,
      docKeys,
      limit: 5,
    });

    return {
      period: {
        key: periodKey,
        start: start.toISOString(),
        end: end.toISOString(),
      },
      stats,
      series,
      recent,
    };
  },
};

function resolveWorkspacePeriod(periodKey) {
  const end = new Date();
  const start = new Date(end);
  if (periodKey === '30d') {
    start.setUTCDate(start.getUTCDate() - 30);
  } else if (periodKey === 'week') {
    // ISO week: Monday 00:00 UTC
    const day = start.getUTCDay(); // 0 Sun … 6 Sat
    const diff = day === 0 ? 6 : day - 1;
    start.setUTCDate(start.getUTCDate() - diff);
    start.setUTCHours(0, 0, 0, 0);
  } else {
    // 7d
    start.setUTCDate(start.getUTCDate() - 7);
  }
  return { start, end };
}

function scopeSqlFragment(scopeKeys, replacements, prefix = 'scope') {
  // null keys = global (no filter); empty = no access (force false)
  if (scopeKeys === null) return { sql: 'TRUE', replacements };
  if (!Array.isArray(scopeKeys) || scopeKeys.length === 0) {
    return { sql: 'FALSE', replacements };
  }
  const key = `${prefix}_ids`;
  return {
    sql: `owning_scope_id IN (:${key})`,
    replacements: { ...replacements, [key]: scopeKeys },
  };
}

async function countContentStatuses(sequelize, {
  table, scopeKeys, start, end, withScheduled,
}) {
  const base = { start, end };
  const { sql: scopeSql, replacements } = scopeSqlFragment(scopeKeys, base);

  const scheduledSelect = withScheduled
    ? `COUNT(*) FILTER (WHERE status = 'SCHEDULED')::int AS scheduled,`
    : '';

  try {
    const [row] = await sequelize.query(`
      SELECT
        COUNT(*) FILTER (
          WHERE status = 'PUBLISHED'
            AND published_at IS NOT NULL
            AND published_at >= :start
            AND published_at <= :end
        )::int AS published,
        COUNT(*) FILTER (WHERE status = 'DRAFT')::int AS draft,
        ${scheduledSelect}
        1 AS _
      FROM ${table}
      WHERE deleted_at IS NULL
        AND (${scopeSql})
    `, { replacements, type: QueryTypes.SELECT });

    return {
      published: Number(row?.published || 0),
      draft: Number(row?.draft || 0),
      scheduled: withScheduled ? Number(row?.scheduled || 0) : 0,
    };
  } catch (e) {
    return { published: 0, draft: 0, scheduled: 0 };
  }
}

function eachUtcDay(start, end) {
  const days = [];
  const cursor = new Date(Date.UTC(
    start.getUTCFullYear(),
    start.getUTCMonth(),
    start.getUTCDate(),
  ));
  const last = new Date(Date.UTC(
    end.getUTCFullYear(),
    end.getUTCMonth(),
    end.getUTCDate(),
  ));
  while (cursor <= last) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

async function publishCountsByDay(sequelize, {
  table, scopeKeys, start, end, replacementsKey,
}) {
  const base = { start, end };
  const { sql: scopeSql, replacements } = scopeSqlFragment(scopeKeys, base, replacementsKey);
  try {
    return await sequelize.query(`
      SELECT
        to_char(date_trunc('day', published_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
        COUNT(*)::int AS count
      FROM ${table}
      WHERE deleted_at IS NULL
        AND status = 'PUBLISHED'
        AND published_at IS NOT NULL
        AND published_at >= :start
        AND published_at <= :end
        AND (${scopeSql})
      GROUP BY day
      ORDER BY day ASC
    `, { replacements, type: QueryTypes.SELECT });
  } catch (e) {
    return [];
  }
}

async function buildPublishSeries(sequelize, {
  start, end, includeNews, includeDocs, includeAnnouncements, newsKeys, docKeys,
}) {
  const days = eachUtcDay(start, end);
  const byDay = Object.fromEntries(days.map((d) => [d, { date: d, news: 0, documents: 0, announcements: 0 }]));

  const tasks = [];
  if (includeNews) {
    tasks.push(publishCountsByDay(sequelize, {
      table: 'news_item', scopeKeys: newsKeys, start, end, replacementsKey: 'news',
    }).then((rows) => {
      rows.forEach((r) => { if (byDay[r.day]) byDay[r.day].news = Number(r.count); });
    }));
  }
  if (includeDocs) {
    tasks.push(publishCountsByDay(sequelize, {
      table: 'document_item', scopeKeys: docKeys, start, end, replacementsKey: 'docs',
    }).then((rows) => {
      rows.forEach((r) => { if (byDay[r.day]) byDay[r.day].documents = Number(r.count); });
    }));
  }
  if (includeAnnouncements) {
    tasks.push(publishCountsByDay(sequelize, {
      table: 'announcement_item', scopeKeys: newsKeys, start, end, replacementsKey: 'ann',
    }).then((rows) => {
      rows.forEach((r) => { if (byDay[r.day]) byDay[r.day].announcements = Number(r.count); });
    }));
  }
  await Promise.all(tasks);
  return days.map((d) => byDay[d]);
}

async function fetchRecentPublished(sequelize, {
  includeNews, includeDocs, includeAnnouncements, newsKeys, docKeys, limit,
}) {
  const logger = require('../../config/logger');
  const parts = [];
  let replacements = { limit };

  // Cast status/priority to text — each table has its own Postgres ENUM type,
  // so UNION ALL fails without a common type.
  if (includeNews) {
    const { sql, replacements: r } = scopeSqlFragment(newsKeys, replacements, 'r_news');
    replacements = r;
    parts.push(`
      SELECT 'NEWS'::text AS entity_type, news_item_id AS id, title,
        published_at, status::text AS status, priority::text AS priority
      FROM news_item
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at IS NOT NULL AND (${sql})
    `);
  }
  if (includeDocs) {
    const { sql, replacements: r } = scopeSqlFragment(docKeys, replacements, 'r_docs');
    replacements = r;
    parts.push(`
      SELECT 'DOCUMENT'::text AS entity_type, document_item_id AS id, title,
        published_at, status::text AS status, priority::text AS priority
      FROM document_item
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at IS NOT NULL AND (${sql})
    `);
  }
  if (includeAnnouncements) {
    const { sql, replacements: r } = scopeSqlFragment(newsKeys, replacements, 'r_ann');
    replacements = r;
    parts.push(`
      SELECT 'ANNOUNCEMENT'::text AS entity_type, announcement_item_id AS id, title,
        published_at, status::text AS status, priority::text AS priority
      FROM announcement_item
      WHERE deleted_at IS NULL AND status = 'PUBLISHED' AND published_at IS NOT NULL AND (${sql})
    `);
  }

  if (parts.length === 0) return [];

  try {
    const rows = await sequelize.query(`
      SELECT * FROM (
        ${parts.join('\nUNION ALL\n')}
      ) AS recent
      ORDER BY published_at DESC NULLS LAST
      LIMIT :limit
    `, { replacements, type: QueryTypes.SELECT });

    const mapped = rows.map((r) => ({
      entity_type: r.entity_type,
      id: Number(r.id),
      title: r.title,
      published_at: r.published_at,
      status: r.status,
      priority: r.priority || null,
    }));

    const { attachAudienceSummariesToRecent } = require('../../services/audience-summary.service');
    return attachAudienceSummariesToRecent(mapped);
  } catch (e) {
    logger.warn(`content-workspace recent published query failed: ${e.message}`);
    return [];
  }
}

module.exports = analyticsService;
