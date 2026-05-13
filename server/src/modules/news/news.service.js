const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const audienceService = require('../../services/audience.service');
const scopeVisibilityService = require('../../services/scope-visibility.service');
const { assertAudienceWithinUserScope } = require('../../services/publishing-scope.service');
const { sanitiseRichText } = require('../../utils/sanitiseRichText');

// Normalise client-supplied related-news ids: dedupe, drop self, cap at 10.
function normaliseRelatedIds(ids, selfId) {
  if (!Array.isArray(ids)) return undefined;
  const seen = new Set();
  const out = [];
  for (const raw of ids) {
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) continue;
    if (selfId && n === selfId) continue;
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
    if (out.length >= 10) break;
  }
  return out;
}

// Resolve related_news_ids into populated cards. Skips ids that no longer
// exist (deleted/never-existed) so dead links never render.
async function loadRelatedNews(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return [];
  const { NewsItem } = require('../../database/models');
  const { Op } = require('sequelize');
  const rows = await NewsItem.findAll({
    where: { news_item_id: { [Op.in]: ids } },
    attributes: ['news_item_id', 'title', 'slug', 'status', 'published_at'],
  });
  const byId = new Map(rows.map((r) => [r.news_item_id, r]));
  // Preserve the user's selection order.
  return ids.map((id) => byId.get(id)).filter(Boolean);
}

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

async function canManageNews(userId) {
  const [canCreate, canEdit, canDelete, canPublish] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'CREATE'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'EDIT'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'DELETE'),
    permissionService.hasPermissionAnywhere(userId, 'NEWS', 'PUBLISH'),
  ]);

  return canCreate || canEdit || canDelete || canPublish;
}

const getUserAudienceScopeKeys = (userId) => audienceService.getUserAudienceScopeKeys(userId, 'news');
const articleMatchesAudience = (article, userAudienceScopeKeys) =>
  audienceService.matchesAudience(article.audienceRules, userAudienceScopeKeys);

// Decorates an array of NewsItem instances with engagement counts and the
// caller's own `my_like` / `my_save` flags. Mutates each article via
// `setDataValue` so the server's JSON serialiser picks them up alongside the
// existing fields.
async function enrichWithEngagement(articles, userId) {
  if (!Array.isArray(articles) || articles.length === 0) return;
  const newsEngagement = require('./news-engagement.service');
  const ids = articles.map((a) => Number(a.news_item_id));
  const [counts, mine] = await Promise.all([
    newsEngagement.getCountsForArticles(ids),
    userId ? newsEngagement.getMyInteractions(ids, userId) : Promise.resolve(new Map()),
  ]);
  articles.forEach((article) => {
    const id = Number(article.news_item_id);
    const c = counts.get(id) || { like_count: 0, comment_count: 0, share_count: 0, save_count: 0 };
    article.setDataValue('like_count', c.like_count);
    article.setDataValue('comment_count', c.comment_count);
    article.setDataValue('share_count', c.share_count);
    article.setDataValue('save_count', c.save_count);
    const m = mine.get(id) || { my_like: false, my_save: false };
    article.setDataValue('my_like', m.my_like);
    article.setDataValue('my_save', m.my_save);
  });
}

function buildAdminNewsOrder(sequelize, trash) {
  return [
    [
      sequelize.literal(`CASE
        WHEN "NewsItem"."status" = 'PUBLISHED' THEN 0
        WHEN "NewsItem"."status" = 'ARCHIVED' THEN 1
        WHEN "NewsItem"."status" = 'DRAFT' THEN 2
        ELSE 3
      END`),
      'ASC',
    ],
    [trash ? 'deleted_at' : 'created_at', 'DESC'],
  ];
}

const newsService = {
  async list(query, userId) {
    const { NewsItem, UserAccount, ContentAudienceRule, Category } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);
    const [managing, isGlobal] = await Promise.all([
      canManageNews(userId),
      permissionService.isGlobalManager(userId, 'NEWS'),
    ]);
    const trash = managing && (query.trash === true || query.trash === 'true');

    const where = trash
      ? { deleted_at: { [Op.ne]: null } }
      : { deleted_at: null };
    if (managing) {
      if (query.status) where.status = query.status;
      // Scoped manager (e.g. Content Editor at DEPARTMENT) sees articles
      // whose owning_scope matches one of their role-assignment scopes OR
      // is a descendant of one. Two editors at the same scope see each
      // other's content. Global managers (Owner / ORG-scope role) skip
      // this filter entirely.
      if (!isGlobal) {
        const readableKeys = await scopeVisibilityService.getReadableScopeKeys(userId, 'NEWS');
        const orCondition = scopeVisibilityService.buildOwningScopeOrCondition(readableKeys);
        if (orCondition === null) {
          // null => global access; let through (shouldn't happen since !isGlobal, but defensive)
        } else if (orCondition.length === 0) {
          // No readable scope at all → empty result
          return {
            articles: [],
            pagination: buildPagination(page, limit, 0),
            status_counts: { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 },
          };
        } else {
          // Use Op.and to avoid clobbering any other Op.or (e.g. search).
          where[Op.and] = [...(where[Op.and] || []), { [Op.or]: orCondition }];
        }
      }
    } else {
      if (query.status && query.status !== 'PUBLISHED') {
        return {
          articles: [],
          pagination: buildPagination(page, limit, 0),
        };
      }
      where.status = 'PUBLISHED';
    }
    if (query.category_id) where.category_id = query.category_id;
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];
    const include = [
      { model: UserAccount, as: 'author', attributes: userAttrs },
      { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
    ];

    if (managing) {
      include.push(
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'publisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'unpublisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'archiver', attributes: userAttrs, required: false },
      );
    }

    if (!managing) {
      include.push({
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'NEWS' },
        required: false,
      });
    }

    if (managing) {
      const { sequelize } = require('../../database/models');
      const countWhere = { ...where };
      delete countWhere.status;

      const Model = trash ? NewsItem.unscoped() : NewsItem;
      const [{ rows, count }, statusBreakdown] = await Promise.all([
        Model.findAndCountAll({
          where,
          limit,
          offset,
          include,
          order: buildAdminNewsOrder(sequelize, trash),
        }),
        Model.findAll({
          where: countWhere,
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('news_item_id')), 'count']],
          group: ['status'],
          raw: true,
        }),
      ]);

      const statusCounts = { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 };
      statusBreakdown.forEach((row) => {
        const c = Number(row.count);
        statusCounts[row.status] = c;
        statusCounts.ALL += c;
      });

      await enrichWithEngagement(rows, userId);

      return {
        articles: rows,
        pagination: buildPagination(page, limit, count),
        status_counts: statusCounts,
      };
    }

    const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
    const rows = await NewsItem.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });

    const visibleArticles = rows.filter((article) => articleMatchesAudience(article, userAudienceScopeKeys));
    const paginatedArticles = visibleArticles.slice(offset, offset + limit);

    await enrichWithEngagement(paginatedArticles, userId);

    return {
      articles: paginatedArticles,
      pagination: buildPagination(page, limit, visibleArticles.length),
      status_counts: {
        ALL: visibleArticles.length,
        DRAFT: 0,
        PUBLISHED: visibleArticles.length,
        ARCHIVED: 0,
      },
    };
  },

  async getById(id, userId = null) {
    const { NewsItem, UserAccount, ContentAudienceRule, Category } = require('../../database/models');

    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];
    const article = await NewsItem.findByPk(id, {
      include: [
        { model: UserAccount, as: 'author', attributes: userAttrs },
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'publisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'unpublisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'archiver', attributes: userAttrs, required: false },
        {
          model: Category,
          as: 'category',
          attributes: ['category_id', 'name', 'slug'],
          required: false,
        },
        {
          model: ContentAudienceRule,
          as: 'audienceRules',
          where: { entity_type: 'NEWS' },
          required: false,
        },
      ],
    });

    if (!article) throw ApiError.notFound('News article not found');

    if (userId) {
      const managing = await canManageNews(userId);
      if (!managing) {
        if (article.status !== 'PUBLISHED') {
          throw ApiError.notFound('News article not found');
        }

        const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
        if (!articleMatchesAudience(article, userAudienceScopeKeys)) {
          throw ApiError.notFound('News article not found');
        }
      }
    }

    // Hydrate related-news cards. Sequelize attaches them to the JSON view via
    // `setDataValue` so the controller's res.json picks them up alongside the
    // existing fields.
    const relatedNews = await loadRelatedNews(article.related_news_ids || []);
    article.setDataValue('relatedNews', relatedNews);

    await enrichWithEngagement([article], userId);

    return article;
  },

  async create(data, authorId) {
    const { NewsItem, ContentAudienceRule, sequelize } = require('../../database/models');

    await assertAudienceWithinUserScope(authorId, data.audience_targets || []);

    const transaction = await sequelize.transaction();

    try {
      const slug = generateSlug(data.title) + '-' + Date.now();

      const article = await NewsItem.create({
        tenant_id: DEFAULT_TENANT_ID,
        title: data.title,
        slug,
        summary: data.summary || null,
        body: sanitiseRichText(data.body || ''),
        cover_image_url: data.cover_image_url || null,
        cover_image_id: data.cover_image_id || null,
        category_id: data.category_id || null,
        priority: data.priority || 'NORMAL',
        related_news_ids: normaliseRelatedIds(data.related_news_ids) || [],
        status: 'DRAFT',
        author_id: authorId,
        owning_scope_type: data.owning_scope_type || 'ORGANISATION',
        owning_scope_id: data.owning_scope_id,
      }, { transaction });

      const audienceRules = (data.audience_targets || []).map((target) => ({
        entity_type: 'NEWS',
        entity_id: article.news_item_id,
        target_scope_type: target.scope_type || 'ORGANISATION',
        target_scope_id: target.scope_id,
      }));

      if (audienceRules.length > 0) {
        await ContentAudienceRule.bulkCreate(audienceRules, { transaction });
      }

      await auditService.log({
        user_id: authorId,
        action: 'NEWS_CREATED',
        resource_type: 'NewsItem',
        resource_id: article.news_item_id,
        details: { title: data.title },
      });

      await transaction.commit();
      return this.getById(article.news_item_id, authorId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, userId) {
    const { NewsItem, ContentAudienceRule, sequelize } = require('../../database/models');

    if (Array.isArray(data.audience_targets)) {
      await assertAudienceWithinUserScope(userId, data.audience_targets);
    }

    const transaction = await sequelize.transaction();

    try {
      const article = await NewsItem.findByPk(id, { transaction });
      if (!article) throw ApiError.notFound('News article not found');

      const fields = ['title', 'summary', 'cover_image_url', 'cover_image_id', 'category_id', 'priority'];
      fields.forEach((f) => {
        if (data[f] !== undefined) article[f] = data[f];
      });

      if (data.body !== undefined) {
        article.body = sanitiseRichText(data.body || '');
      }

      if (data.related_news_ids !== undefined) {
        const next = normaliseRelatedIds(data.related_news_ids, Number(id));
        if (next !== undefined) article.related_news_ids = next;
      }

      if (data.title) article.slug = generateSlug(data.title) + '-' + Date.now();

      article.updated_by = userId;
      await article.save({ transaction });

      if (Array.isArray(data.audience_targets)) {
        await ContentAudienceRule.destroy({
          where: { entity_type: 'NEWS', entity_id: id },
          transaction,
        });

        if (data.audience_targets.length > 0) {
          await ContentAudienceRule.bulkCreate(data.audience_targets.map((target) => ({
              entity_type: 'NEWS',
              entity_id: id,
              target_scope_type: target.scope_type || 'ORGANISATION',
              target_scope_id: target.scope_id,
            })), { transaction });
        }
      }

      await auditService.log({
        user_id: userId,
        action: 'NEWS_UPDATED',
        resource_type: 'NewsItem',
        resource_id: id,
      });

      await transaction.commit();
      return this.getById(id, userId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async delete(id, userId) {
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');
    if (article.status === 'PUBLISHED') {
      throw ApiError.badRequest('Archive this article before moving it to the trash');
    }

    await article.update({ deleted_at: new Date(), deleted_by: userId });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_TRASHED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return { message: 'Article moved to trash' };
  },

  async bulkRestore(ids, userId) {
    const { NewsItem } = require('../../database/models');
    const { Op } = require('sequelize');

    const articles = await NewsItem.unscoped().findAll({
      where: { news_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });

    let restored = 0;
    for (const article of articles) {
      await article.update({ deleted_at: null });
      restored += 1;
    }

    if (restored > 0) {
      await auditService.log({
        user_id: userId,
        action: 'NEWS_RESTORED',
        resource_type: 'NewsItem',
        resource_id: articles[0]?.news_item_id || null,
        details: { count: restored },
      });
    }

    return { restored };
  },

  async bulkPurge(ids, userId) {
    const { NewsItem, ContentAudienceRule } = require('../../database/models');
    const { Op } = require('sequelize');

    const articles = await NewsItem.unscoped().findAll({
      where: { news_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });

    let purged = 0;
    for (const article of articles) {
      await ContentAudienceRule.destroy({
        where: { entity_type: 'NEWS', entity_id: article.news_item_id },
      });
      await article.destroy({ force: true });
      purged += 1;
    }

    if (purged > 0) {
      await auditService.log({
        user_id: userId,
        action: 'NEWS_PURGED',
        resource_type: 'NewsItem',
        resource_id: null,
        details: { count: purged },
      });
    }

    return { purged };
  },

  async publish(id, userId) {
    const { NewsItem, ContentAudienceRule } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');
    if (article.status === 'PUBLISHED') throw ApiError.badRequest('Article is already published');

    await article.update({
      status: 'PUBLISHED',
      published_at: new Date(),
      published_by: userId,
      unpublished_at: null,
      unpublished_by: null,
    });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_PUBLISHED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    // Fan notifications out to the audience. Fire-and-forget — the publish
    // action must succeed even if notification persistence/socket fails.
    // The internal try/catch in notifyOnPublish handles errors, but we add an
    // extra `.catch()` here as a safety net in case it ever rethrows.
    const audienceRules = await ContentAudienceRule.findAll({
      where: { entity_type: 'NEWS', entity_id: id },
    });
    const notificationService = require('../notifications/notifications.service');
    const logger = require('../../config/logger');
    notificationService
      .notifyOnPublish({
        type: 'NEWS',
        entity: { id, title: article.title, summary: article.summary },
        audienceRules,
        entityKey: 'news',
      })
      .catch((err) => logger.error(`notifyOnPublish (NEWS ${id}) rejected: ${err.message}`));

    return this.getById(id);
  },

  // Re-send the publish notification for an already-published article.
  // Useful for:
  //   - backfilling rows when a previous fan-out failed silently
  //   - nudging employees about an older important post
  //   - one-click smoke testing the pipeline in production
  async resendNotification(id) {
    const { NewsItem, ContentAudienceRule } = require('../../database/models');
    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');
    if (article.status !== 'PUBLISHED') {
      throw ApiError.badRequest('Only published articles can be re-sent');
    }

    const audienceRules = await ContentAudienceRule.findAll({
      where: { entity_type: 'NEWS', entity_id: id },
    });
    const notificationService = require('../notifications/notifications.service');
    return notificationService.notifyOnPublish({
      type: 'NEWS',
      entity: { id, title: article.title, summary: article.summary },
      audienceRules,
      entityKey: 'news',
    });
  },

  // "Publish Now" flow: create a draft and immediately flip it to PUBLISHED.
  // If publish fails after create, soft-delete the orphan draft to keep the
  // list clean.
  async createAndPublish(data, userId) {
    const created = await this.create(data, userId);
    try {
      return await this.publish(created.news_item_id, userId);
    } catch (err) {
      try {
        await this.delete(created.news_item_id, userId);
      } catch (cleanupErr) {
        // Logged via the audit/error pipeline elsewhere; nothing more to do.
      }
      throw err;
    }
  },

  async archive(id, userId) {
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');

    await article.update({ status: 'ARCHIVED', archived_at: new Date(), archived_by: userId });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_ARCHIVED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return this.getById(id);
  },

  async unpublish(id, userId) {
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');
    if (article.status !== 'PUBLISHED') {
      throw ApiError.badRequest('Only published articles can be unpublished');
    }

    await article.update({
      status: 'DRAFT',
      unpublished_at: new Date(),
      unpublished_by: userId,
    });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_UNPUBLISHED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return this.getById(id);
  },

  async setAudience(id, orgUnitIds, userId) {
    const { ContentAudienceRule, sequelize } = require('../../database/models');

    await assertAudienceWithinUserScope(userId, orgUnitIds || []);

    const transaction = await sequelize.transaction();

    try {
      await ContentAudienceRule.destroy({
        where: { entity_type: 'NEWS', entity_id: id },
        transaction,
      });

      const rules = orgUnitIds.map((target) => ({
        entity_type: 'NEWS',
        entity_id: id,
        target_scope_type: target.scope_type || 'ORGANISATION',
        target_scope_id: target.scope_id,
      }));

      await ContentAudienceRule.bulkCreate(rules, { transaction });
      await transaction.commit();

      return this.getById(id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },
};

module.exports = newsService;
