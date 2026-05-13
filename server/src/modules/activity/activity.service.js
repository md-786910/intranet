const { Op } = require('sequelize');
const permissionService = require('../../services/permission.service');
const scopeVisibilityService = require('../../services/scope-visibility.service');
const { parsePagination, buildPagination } = require('../../utils/pagination');

const USER_ATTRS = ['user_id', 'first_name', 'last_name', 'email'];
const FETCH_PER_ENTITY = 200; // upper bound per type; we merge + paginate

function actor(u) {
  if (!u) return null;
  return {
    user_id: u.user_id,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email,
  };
}

// Build event objects from one entity's audit columns. Entity-specific
// adapters all return `{ kind, entity_type, entity_id, entity_title,
// entity_link, actor, at }`.
function buildNewsEvents(article) {
  const out = [];
  const base = {
    entity_type: 'NEWS',
    entity_id: article.news_item_id,
    entity_title: article.title,
    entity_link: `/news/${article.news_item_id}`,
  };
  // Fallback to the article's author whenever a specific actor column is
  // missing — typically legacy rows whose audit fields predate migration 054.
  const fallback = actor(article.author);
  if (article.created_at) out.push({ ...base, kind: 'created', actor: fallback, at: article.created_at });
  if (article.updater && article.updated_at && +article.updated_at !== +article.created_at) {
    out.push({ ...base, kind: 'updated', actor: actor(article.updater) || fallback, at: article.updated_at });
  }
  if (article.published_at) out.push({ ...base, kind: 'published', actor: actor(article.publisher) || fallback, at: article.published_at });
  if (article.unpublished_at) out.push({ ...base, kind: 'unpublished', actor: actor(article.unpublisher) || fallback, at: article.unpublished_at });
  if (article.archived_at) out.push({ ...base, kind: 'archived', actor: actor(article.archiver) || fallback, at: article.archived_at });
  if (article.deleted_at) out.push({ ...base, kind: 'deleted', actor: actor(article.deleter) || fallback, at: article.deleted_at });
  return out;
}

function buildDocumentEvents(doc) {
  const out = [];
  const base = {
    entity_type: 'DOCUMENT',
    entity_id: doc.document_item_id,
    entity_title: doc.title,
    entity_link: `/documents/${doc.document_item_id}`,
  };
  const fallback = actor(doc.author);
  if (doc.created_at) out.push({ ...base, kind: 'created', actor: fallback, at: doc.created_at });
  if (doc.updater && doc.updated_at && +doc.updated_at !== +doc.created_at) {
    out.push({ ...base, kind: 'updated', actor: actor(doc.updater) || fallback, at: doc.updated_at });
  }
  if (doc.published_at) out.push({ ...base, kind: 'published', actor: actor(doc.publisher) || fallback, at: doc.published_at });
  if (doc.unpublished_at) out.push({ ...base, kind: 'unpublished', actor: actor(doc.unpublisher) || fallback, at: doc.unpublished_at });
  if (doc.deleted_at) out.push({ ...base, kind: 'deleted', actor: actor(doc.deleter) || fallback, at: doc.deleted_at });
  return out;
}

function buildCategoryEvents(cat) {
  const out = [];
  const base = {
    entity_type: 'CATEGORY',
    entity_id: cat.category_id,
    entity_title: cat.name,
    entity_link: '/categories',
  };
  const fallback = actor(cat.creator);
  if (cat.createdAt) out.push({ ...base, kind: 'created', actor: fallback, at: cat.createdAt });
  if (cat.updater && cat.updatedAt && +cat.updatedAt !== +cat.createdAt) {
    out.push({ ...base, kind: 'updated', actor: actor(cat.updater) || fallback, at: cat.updatedAt });
  }
  if (cat.deleted_at) out.push({ ...base, kind: 'deleted', actor: actor(cat.deleter) || fallback, at: cat.deleted_at });
  return out;
}

function buildMediaEvents(asset) {
  const out = [];
  const base = {
    entity_type: 'MEDIA',
    entity_id: asset.media_asset_id,
    entity_title: asset.original_name,
    entity_link: '/media',
  };
  const fallback = actor(asset.uploader);
  if (asset.createdAt) out.push({ ...base, kind: 'uploaded', actor: fallback, at: asset.createdAt });
  if (asset.deleted_at) out.push({ ...base, kind: 'deleted', actor: actor(asset.deleter) || fallback, at: asset.deleted_at });
  return out;
}

async function fetchNewsEvents(userId) {
  const { NewsItem, UserAccount } = require('../../database/models');
  const isGlobal = await permissionService.isGlobalManager(userId, 'NEWS');

  const where = {};
  if (!isGlobal) {
    const keys = await scopeVisibilityService.getReadableScopeKeys(userId, 'NEWS');
    const orCondition = scopeVisibilityService.buildOwningScopeOrCondition(keys);
    if (orCondition === null) {
      // global passthrough
    } else if (orCondition.length === 0) {
      return [];
    } else {
      where[Op.or] = orCondition;
    }
  }

  const rows = await NewsItem.unscoped().findAll({
    where,
    limit: FETCH_PER_ENTITY,
    order: [['updated_at', 'DESC']],
    include: [
      { model: UserAccount, as: 'author', attributes: USER_ATTRS },
      { model: UserAccount, as: 'updater', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'publisher', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'unpublisher', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'archiver', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'deleter', attributes: USER_ATTRS, required: false },
    ],
  });

  return rows.flatMap(buildNewsEvents);
}

async function fetchDocumentEvents(userId) {
  const { DocumentItem, UserAccount } = require('../../database/models');
  const isGlobal = await permissionService.isGlobalManager(userId, 'DOCUMENTS');

  const where = {};
  if (!isGlobal) {
    const keys = await scopeVisibilityService.getReadableScopeKeys(userId, 'DOCUMENTS');
    const orCondition = scopeVisibilityService.buildOwningScopeOrCondition(keys);
    if (orCondition === null) {
      // global passthrough
    } else if (orCondition.length === 0) {
      return [];
    } else {
      where[Op.or] = orCondition;
    }
  }

  const rows = await DocumentItem.unscoped().findAll({
    where,
    limit: FETCH_PER_ENTITY,
    order: [['updated_at', 'DESC']],
    include: [
      { model: UserAccount, as: 'author', attributes: USER_ATTRS },
      { model: UserAccount, as: 'updater', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'publisher', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'unpublisher', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'deleter', attributes: USER_ATTRS, required: false },
    ],
  });

  return rows.flatMap(buildDocumentEvents);
}

async function fetchCategoryEvents(userId) {
  const { Category, UserAccount } = require('../../database/models');
  // Categories have no owning_scope — use creator peer-set rule.
  const peerUserIds = await scopeVisibilityService.getCollaboratorUserIds(userId, ['NEWS', 'DOCUMENTS']);

  const where = {};
  if (peerUserIds !== null) {
    if (peerUserIds.length === 0) return [];
    where.creator_id = { [Op.in]: peerUserIds };
  }

  const rows = await Category.unscoped().findAll({
    where,
    limit: FETCH_PER_ENTITY,
    order: [['updatedAt', 'DESC']],
    include: [
      { model: UserAccount, as: 'creator', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'updater', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'deleter', attributes: USER_ATTRS, required: false },
    ],
  });

  return rows.flatMap(buildCategoryEvents);
}

async function fetchMediaEvents(userId) {
  const { MediaAsset, UserAccount } = require('../../database/models');
  // Media follows the same peer-set rule as categories.
  const peerUserIds = await scopeVisibilityService.getCollaboratorUserIds(userId, ['NEWS', 'DOCUMENTS']);

  const where = {};
  if (peerUserIds !== null) {
    if (peerUserIds.length === 0) return [];
    where.uploaded_by = { [Op.in]: peerUserIds };
  }

  const rows = await MediaAsset.unscoped().findAll({
    where,
    limit: FETCH_PER_ENTITY,
    order: [['createdAt', 'DESC']],
    include: [
      { model: UserAccount, as: 'uploader', attributes: USER_ATTRS, required: false },
      { model: UserAccount, as: 'deleter', attributes: USER_ATTRS, required: false },
    ],
  });

  return rows.flatMap(buildMediaEvents);
}

const activityService = {
  /**
   * Returns a unified, chronologically-sorted activity feed across news /
   * documents / categories / media. Scope-aware per the same rules used by
   * the per-module list endpoints.
   *
   * Query params:
   *   entity_type — filter to one of NEWS | DOCUMENT | CATEGORY | MEDIA
   *   kind        — filter by event kind (created, updated, published, ...)
   *   page, limit — pagination
   */
  async list(query, userId) {
    const { page, limit, offset } = parsePagination(query);

    const wanted = query.entity_type
      ? [String(query.entity_type).toUpperCase()]
      : ['NEWS', 'DOCUMENT', 'CATEGORY', 'MEDIA'];

    const fetchers = [];
    if (wanted.includes('NEWS')) fetchers.push(fetchNewsEvents(userId));
    if (wanted.includes('DOCUMENT')) fetchers.push(fetchDocumentEvents(userId));
    if (wanted.includes('CATEGORY')) fetchers.push(fetchCategoryEvents(userId));
    if (wanted.includes('MEDIA')) fetchers.push(fetchMediaEvents(userId));

    const results = await Promise.all(fetchers);
    let events = results.flat();

    if (query.kind) {
      const kinds = String(query.kind).split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
      if (kinds.length > 0) events = events.filter((e) => kinds.includes(e.kind));
    }

    events.sort((a, b) => new Date(b.at) - new Date(a.at));

    const total = events.length;
    const paginated = events.slice(offset, offset + limit);

    return {
      events: paginated,
      pagination: buildPagination(page, limit, total),
    };
  },
};

module.exports = activityService;
