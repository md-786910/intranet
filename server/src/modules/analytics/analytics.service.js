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
};

module.exports = analyticsService;
