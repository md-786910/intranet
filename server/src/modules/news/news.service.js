const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const scopeService = require('../../services/scope.service');
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

async function getUserAudienceScopeKeys(userId) {
  const {
    UserRoleAssignment,
    UserPermission,
    DepartmentMembership,
  } = require('../../database/models');

  const scopeKeys = new Set();
  const addAncestors = async (scopeType, scopeId) => {
    if (!scopeType || !scopeId) return;
    const ancestors = await scopeService.resolveAncestors(scopeType, scopeId);
    if (!ancestors) return;

    if (ancestors.organisation_id) scopeKeys.add(`ORGANISATION:${ancestors.organisation_id}`);
    if (ancestors.office_location_id) scopeKeys.add(`OFFICE_LOCATION:${ancestors.office_location_id}`);
    if (ancestors.vertical_id) scopeKeys.add(`VERTICAL:${ancestors.vertical_id}`);
    if (ancestors.department_id) scopeKeys.add(`DEPARTMENT:${ancestors.department_id}`);
  };

  const [roleAssignments, directPermissions, departmentMemberships] = await Promise.all([
    UserRoleAssignment.findAll({
      where: { user_id: userId },
      attributes: ['scope_type', 'scope_id'],
    }),
    UserPermission.findAll({
      where: { user_id: userId, effect: 'ALLOW' },
      attributes: ['scope_type', 'scope_id'],
    }),
    DepartmentMembership.findAll({
      where: { user_id: userId },
      attributes: ['department_id'],
    }),
  ]);

  for (const assignment of roleAssignments) {
    await addAncestors(assignment.scope_type, assignment.scope_id);
  }

  for (const permission of directPermissions) {
    await addAncestors(permission.scope_type, permission.scope_id);
  }

  for (const membership of departmentMemberships) {
    await addAncestors('DEPARTMENT', membership.department_id);
  }

  return scopeKeys;
}

function articleMatchesAudience(article, userAudienceScopeKeys) {
  const audienceRules = article.audienceRules || [];
  if (audienceRules.length === 0) return true;

  return audienceRules.some((rule) =>
    userAudienceScopeKeys.has(`${rule.target_scope_type}:${rule.target_scope_id}`));
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
    const managing = await canManageNews(userId);
    const trash = managing && (query.trash === true || query.trash === 'true');

    const where = trash
      ? { deleted_at: { [Op.ne]: null } }
      : { deleted_at: null };
    if (managing) {
      if (query.status) where.status = query.status;
    } else {
      if (query.status && query.status !== 'PUBLISHED') {
        return {
          articles: [],
          pagination: buildPagination(page, limit, 0),
        };
      }
      where.status = 'PUBLISHED';
    }
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const include = [
      {
        model: UserAccount,
        as: 'author',
        attributes: ['user_id', 'first_name', 'last_name', 'email'],
      },
      {
        model: Category,
        as: 'category',
        attributes: ['category_id', 'name', 'slug'],
        required: false,
      },
    ];

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

    const article = await NewsItem.findByPk(id, {
      include: [
        {
          model: UserAccount,
          as: 'author',
          attributes: ['user_id', 'first_name', 'last_name', 'email'],
        },
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

    return article;
  },

  async create(data, authorId) {
    const { NewsItem, ContentAudienceRule, sequelize } = require('../../database/models');
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

    await article.update({ deleted_at: new Date() });

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
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');
    if (article.status === 'PUBLISHED') throw ApiError.badRequest('Article is already published');

    await article.update({ status: 'PUBLISHED', published_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_PUBLISHED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return this.getById(id);
  },

  async archive(id, userId) {
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');

    await article.update({ status: 'ARCHIVED', archived_at: new Date() });

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

    await article.update({ status: 'DRAFT', published_at: null });

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
