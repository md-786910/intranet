const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const scopeService = require('../../services/scope.service');

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

const newsService = {
  async list(query, userId) {
    const { NewsItem, UserAccount, ContentAudienceRule } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);
    const managing = await canManageNews(userId);

    const where = { deleted_at: null };
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

    const include = [{
      model: UserAccount,
      as: 'author',
      attributes: ['user_id', 'first_name', 'last_name', 'email'],
    }];

    if (!managing) {
      include.push({
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'NEWS' },
        required: false,
      });
    }

    if (managing) {
      const { rows, count } = await NewsItem.findAndCountAll({
        where,
        limit,
        offset,
        include,
        order: [['created_at', 'DESC']],
      });

      return {
        articles: rows,
        pagination: buildPagination(page, limit, count),
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
    };
  },

  async getById(id, userId = null) {
    const { NewsItem, UserAccount, ContentAudienceRule } = require('../../database/models');

    const article = await NewsItem.findByPk(id, {
      include: [
        {
          model: UserAccount,
          as: 'author',
          attributes: ['user_id', 'first_name', 'last_name', 'email'],
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
        body: data.body,
        cover_image_url: data.cover_image_url || null,
        cover_image_id: data.cover_image_id || null,
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

      const fields = ['title', 'summary', 'body', 'cover_image_url', 'cover_image_id'];
      fields.forEach((f) => {
        if (data[f] !== undefined) article[f] = data[f];
      });

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

    await article.update({ deleted_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'NEWS_DELETED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return { message: 'News article deleted successfully' };
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
