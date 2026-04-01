const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const newsService = {
  async list(query) {
    const { NewsItem, UserAccount } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);

    const where = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const { rows, count } = await NewsItem.findAndCountAll({
      where,
      limit,
      offset,
      include: [{
        model: UserAccount,
        as: 'author',
        attributes: ['user_id', 'first_name', 'last_name', 'email'],
      }],
      order: [['created_at', 'DESC']],
    });

    return {
      articles: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
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
    return article;
  },

  async create(data, authorId) {
    const { NewsItem } = require('../../database/models');

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
    });

    await auditService.log({
      user_id: authorId,
      action: 'NEWS_CREATED',
      resource_type: 'NewsItem',
      resource_id: article.news_item_id,
      details: { title: data.title },
    });

    return this.getById(article.news_item_id);
  },

  async update(id, data, userId) {
    const { NewsItem } = require('../../database/models');

    const article = await NewsItem.findByPk(id);
    if (!article) throw ApiError.notFound('News article not found');

    const fields = ['title', 'summary', 'body', 'cover_image_url', 'cover_image_id'];
    fields.forEach((f) => {
      if (data[f] !== undefined) article[f] = data[f];
    });

    if (data.title) article.slug = generateSlug(data.title) + '-' + Date.now();

    await article.save();

    await auditService.log({
      user_id: userId,
      action: 'NEWS_UPDATED',
      resource_type: 'NewsItem',
      resource_id: id,
    });

    return this.getById(id);
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
