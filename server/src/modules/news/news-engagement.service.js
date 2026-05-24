const crypto = require('crypto');
const ApiError = require('../../utils/ApiError');
const audienceService = require('../../services/audience.service');
const permissionService = require('../../services/permission.service');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || process.env.EMPLOYEE_CLIENT_URL || 'http://localhost:3002';

function authorPayload(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    avatar_url: user.avatar_url || null,
  };
}

// Loads the article + audience rules and confirms the user is allowed to
// interact with it (article must exist, be PUBLISHED, and either the user
// can manage news or its audience matches).
async function assertVisibleAndLoad(newsItemId, userId) {
  const { NewsItem, ContentAudienceRule } = require('../../database/models');

  const article = await NewsItem.findOne({
    where: { news_item_id: newsItemId, deleted_at: null },
    include: [{
      model: ContentAudienceRule,
      as: 'audienceRules',
      where: { entity_type: 'NEWS' },
      required: false,
    }],
  });
  if (!article) throw ApiError.notFound('News article not found');

  const canManage = await permissionService.hasPermissionAnywhere(userId, 'NEWS', 'EDIT');
  if (canManage) return article;

  if (article.status !== 'PUBLISHED') throw ApiError.notFound('News article not found');

  const userScopeKeys = await audienceService.getUserAudienceScopeKeys(userId, 'news');
  if (!audienceService.matchesAudience(article.audienceRules, userScopeKeys)) {
    throw ApiError.notFound('News article not found');
  }
  return article;
}

const service = {
  // ── Likes ────────────────────────────────────────────────────────────────
  async addLike(newsItemId, userId) {
    const { NewsLike } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);
    await NewsLike.findOrCreate({
      where: { news_item_id: newsItemId, user_id: userId },
      defaults: { news_item_id: newsItemId, user_id: userId },
    });
    const like_count = await NewsLike.count({ where: { news_item_id: newsItemId } });
    return { liked: true, like_count };
  },

  async removeLike(newsItemId, userId) {
    const { NewsLike } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);
    await NewsLike.destroy({ where: { news_item_id: newsItemId, user_id: userId } });
    const like_count = await NewsLike.count({ where: { news_item_id: newsItemId } });
    return { liked: false, like_count };
  },

  // ── Comments (employee) ──────────────────────────────────────────────────
  async listComments(newsItemId, userId, query) {
    const { NewsComment, UserAccount } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);
    const { page, limit, offset } = parsePagination(query);

    const { rows, count } = await NewsComment.findAndCountAll({
      where: { news_item_id: newsItemId },
      include: [{
        model: UserAccount,
        as: 'author',
        attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
        required: false,
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });

    return {
      comments: rows.map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.createdAt,
        updated_at: c.updatedAt,
        deleted: false,
        author: authorPayload(c.author),
      })),
      pagination: buildPagination(page, limit, count),
    };
  },

  async addComment(newsItemId, userId, body) {
    const { NewsComment, UserAccount } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);

    const comment = await NewsComment.create({
      news_item_id: newsItemId,
      user_id: userId,
      body,
    });

    const author = await UserAccount.findByPk(userId, {
      attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
    });

    const comment_count = await NewsComment.count({ where: { news_item_id: newsItemId } });

    return {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        deleted: false,
        author: authorPayload(author),
      },
      comment_count,
    };
  },

  async updateComment(newsItemId, commentId, userId, body) {
    const { NewsComment, UserAccount } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);

    const comment = await NewsComment.findOne({
      where: { id: commentId, news_item_id: newsItemId },
    });
    if (!comment) throw ApiError.notFound('Comment not found');
    if (comment.user_id !== userId) throw ApiError.forbidden('Not allowed to edit this comment');

    await comment.update({ body });

    const author = await UserAccount.findByPk(userId, {
      attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
    });

    return {
      comment: {
        id: comment.id,
        body: comment.body,
        created_at: comment.createdAt,
        updated_at: comment.updatedAt,
        deleted: false,
        author: authorPayload(author),
      },
    };
  },

  async deleteComment(newsItemId, commentId, userId) {
    const { NewsComment } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);

    const comment = await NewsComment.findOne({
      where: { id: commentId, news_item_id: newsItemId },
    });
    if (!comment) throw ApiError.notFound('Comment not found');

    const isAuthor = comment.user_id === userId;
    const canModerate = await permissionService.hasPermissionAnywhere(userId, 'NEWS', 'EDIT');
    if (!isAuthor && !canModerate) throw ApiError.forbidden('Not allowed to delete this comment');

    await comment.update({ deleted_at: new Date() });

    const comment_count = await NewsComment.count({ where: { news_item_id: newsItemId } });
    return { deleted: true, comment_count };
  },

  // ── Shares ───────────────────────────────────────────────────────────────
  async recordShare(newsItemId, userId, channel) {
    const { NewsShare } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);

    // Make a fresh token each time so revoking one shared link doesn't break
    // others, and each share row is independently traceable.
    const token = crypto.randomBytes(24).toString('base64')
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

    const share = await NewsShare.create({
      news_item_id: newsItemId,
      user_id: userId,
      channel,
      token,
      view_count: 0,
    });

    const share_count = await NewsShare.count({ where: { news_item_id: newsItemId } });
    return {
      token: share.token,
      url: `${PUBLIC_BASE_URL}/s/${share.token}`,
      share_count,
    };
  },

  // ── Public read by share token (no auth) ────────────────────────────────
  async getPublicByToken(token) {
    const { NewsShare, NewsItem, UserAccount, Organisation } = require('../../database/models');
    const share = await NewsShare.findOne({
      where: { token, revoked_at: null },
    });
    if (!share) throw ApiError.notFound('Shared link is invalid or has been revoked');

    const article = await NewsItem.findOne({
      where: { news_item_id: share.news_item_id, deleted_at: null, status: 'PUBLISHED' },
      include: [{
        model: UserAccount,
        as: 'author',
        attributes: ['first_name', 'last_name'],
        required: false,
      }],
    });
    if (!article) throw ApiError.notFound('Shared article is no longer available');

    // Increment view_count, capped to a reasonable upper bound to avoid runaway counters.
    if (share.view_count < 10000) {
      await share.increment('view_count');
    }

    const orgRow = await Organisation.findOne({ attributes: ['name'], order: [['id', 'ASC']] });

    return {
      news_item_id: article.news_item_id,
      title: article.title,
      summary: article.summary,
      body: article.body,
      cover_image_url: article.cover_image_url,
      published_at: article.published_at,
      author_name: article.author
        ? `${article.author.first_name} ${article.author.last_name}`.trim()
        : null,
      organisation_name: orgRow?.name || null,
    };
  },

  // ── Save (uses existing SavedItem) ──────────────────────────────────────
  async addSave(newsItemId, userId) {
    const { SavedItem } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);
    await SavedItem.findOrCreate({
      where: { user_id: userId, entity_type: 'NEWS', entity_id: newsItemId },
      defaults: { user_id: userId, entity_type: 'NEWS', entity_id: newsItemId },
    });
    return { saved: true };
  },

  async removeSave(newsItemId, userId) {
    const { SavedItem } = require('../../database/models');
    await assertVisibleAndLoad(newsItemId, userId);
    await SavedItem.destroy({
      where: { user_id: userId, entity_type: 'NEWS', entity_id: newsItemId },
    });
    return { saved: false };
  },

  // ── Counts + my interactions, used to enrich GET /news/:id and list ─────
  async getCountsForArticles(newsItemIds) {
    if (!Array.isArray(newsItemIds) || newsItemIds.length === 0) return new Map();
    const { sequelize } = require('../../database/models');
    const { QueryTypes } = require('sequelize');

    const rows = await sequelize.query(
      `SELECT
         ni.news_item_id,
         (SELECT COUNT(*)::int FROM news_like     WHERE news_like.news_item_id = ni.news_item_id)                              AS like_count,
         (SELECT COUNT(*)::int FROM news_comment  WHERE news_comment.news_item_id = ni.news_item_id AND deleted_at IS NULL)    AS comment_count,
         (SELECT COUNT(*)::int FROM news_share    WHERE news_share.news_item_id = ni.news_item_id)                             AS share_count,
         (SELECT COUNT(*)::int FROM saved_item    WHERE saved_item.entity_type = 'NEWS' AND saved_item.entity_id = ni.news_item_id) AS save_count
       FROM news_item ni
       WHERE ni.news_item_id IN (:ids)`,
      { replacements: { ids: newsItemIds }, type: QueryTypes.SELECT },
    );

    const map = new Map();
    rows.forEach((r) => {
      map.set(Number(r.news_item_id), {
        like_count: Number(r.like_count) || 0,
        comment_count: Number(r.comment_count) || 0,
        share_count: Number(r.share_count) || 0,
        save_count: Number(r.save_count) || 0,
      });
    });
    return map;
  },

  async getMyInteractions(newsItemIds, userId) {
    if (!userId || !Array.isArray(newsItemIds) || newsItemIds.length === 0) return new Map();
    const { NewsLike, SavedItem } = require('../../database/models');
    const { Op } = require('sequelize');

    const [likes, saves] = await Promise.all([
      NewsLike.findAll({
        where: { user_id: userId, news_item_id: { [Op.in]: newsItemIds } },
        attributes: ['news_item_id'],
      }),
      SavedItem.findAll({
        where: { user_id: userId, entity_type: 'NEWS', entity_id: { [Op.in]: newsItemIds } },
        attributes: ['entity_id'],
      }),
    ]);

    const liked = new Set(likes.map((l) => Number(l.news_item_id)));
    const saved = new Set(saves.map((s) => Number(s.entity_id)));

    const map = new Map();
    newsItemIds.forEach((id) => {
      const n = Number(id);
      map.set(n, { my_like: liked.has(n), my_save: saved.has(n) });
    });
    return map;
  },

  // ── Admin engagement views ──────────────────────────────────────────────
  async adminEngagementSummary(newsItemId) {
    const counts = await service.getCountsForArticles([newsItemId]);
    return {
      counts: counts.get(Number(newsItemId)) || {
        like_count: 0, comment_count: 0, share_count: 0, save_count: 0,
      },
    };
  },

  async adminListLikes(newsItemId, query) {
    const { NewsLike, UserAccount } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);
    const { rows, count } = await NewsLike.findAndCountAll({
      where: { news_item_id: newsItemId },
      include: [{
        model: UserAccount,
        as: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
        required: false,
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    return {
      likes: rows.map((r) => ({
        id: r.id,
        liked_at: r.created_at,
        user: authorPayload(r.user),
      })),
      pagination: buildPagination(page, limit, count),
    };
  },

  async adminListComments(newsItemId, query) {
    const { NewsComment, UserAccount } = require('../../database/models');
    const includeDeleted = query.include_deleted === true || query.include_deleted === 'true';
    const { page, limit, offset } = parsePagination(query);
    const Model = includeDeleted ? NewsComment.scope('withDeleted') : NewsComment;
    const { rows, count } = await Model.findAndCountAll({
      where: { news_item_id: newsItemId },
      include: [{
        model: UserAccount,
        as: 'author',
        attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
        required: false,
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    return {
      comments: rows.map((c) => ({
        id: c.id,
        body: c.body,
        created_at: c.created_at,
        deleted: !!c.deleted_at,
        deleted_at: c.deleted_at,
        author: authorPayload(c.author),
      })),
      pagination: buildPagination(page, limit, count),
    };
  },

  async adminListShares(newsItemId, query) {
    const { NewsShare, UserAccount } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);
    const { rows, count } = await NewsShare.findAndCountAll({
      where: { news_item_id: newsItemId },
      include: [{
        model: UserAccount,
        as: 'user',
        attributes: ['user_id', 'first_name', 'last_name', 'email', 'avatar_url'],
        required: false,
      }],
      order: [['created_at', 'DESC']],
      limit,
      offset,
    });
    return {
      shares: rows.map((s) => ({
        id: s.id,
        channel: s.channel,
        token: s.token,
        view_count: s.view_count,
        revoked_at: s.revoked_at,
        shared_at: s.created_at,
        user: authorPayload(s.user),
      })),
      pagination: buildPagination(page, limit, count),
    };
  },

  async adminModerateComment(newsItemId, commentId) {
    const { NewsComment } = require('../../database/models');
    const comment = await NewsComment.scope('withDeleted').findOne({
      where: { id: commentId, news_item_id: newsItemId },
    });
    if (!comment) throw ApiError.notFound('Comment not found');
    if (!comment.deleted_at) {
      await comment.update({ deleted_at: new Date() });
    }
    return { deleted: true, deleted_at: comment.deleted_at };
  },
};

module.exports = service;
