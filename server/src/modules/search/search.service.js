const { Op } = require('sequelize');
const audienceService = require('../../services/audience.service');
const logger = require('../../config/logger');

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// Build a Sequelize `where` clause that matches any of the given fields
// against `q` via case-insensitive `ILike`. Skips empty queries.
function ilikeAny(fields, q) {
  return { [Op.or]: fields.map((field) => ({ [field]: { [Op.iLike]: `%${q}%` } })) };
}

// ── News ───────────────────────────────────────────────────────────────────

async function searchNews({ userId, q, categoryId, limit }) {
  const { NewsItem, Category, ContentAudienceRule } = require('../../database/models');

  const where = {
    status: 'PUBLISHED',
    deleted_at: null,
    ...ilikeAny(['title', 'summary'], q),
  };
  if (categoryId) where.category_id = Number(categoryId);

  const rows = await NewsItem.findAll({
    where,
    attributes: ['news_item_id', 'title', 'summary', 'published_at', 'cover_image_url', 'category_id'],
    include: [
      { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
      { model: ContentAudienceRule, as: 'audienceRules', where: { entity_type: 'NEWS' }, required: false },
    ],
    order: [['published_at', 'DESC']],
    limit: limit * 2, // over-fetch so audience filter doesn't shrink us below `limit`
  });

  const userKeys = await audienceService.getUserAudienceScopeKeys(userId, 'news');
  return rows
    .filter((row) => audienceService.matchesAudience(row.audienceRules, userKeys))
    .slice(0, limit)
    .map((row) => ({
      id: row.news_item_id,
      title: row.title,
      summary: row.summary,
      published_at: row.published_at,
      cover_image_url: row.cover_image_url,
      category: row.category ? {
        category_id: row.category.category_id,
        name: row.category.name,
        slug: row.category.slug,
      } : null,
    }));
}

// ── Documents ──────────────────────────────────────────────────────────────

async function searchDocuments({ userId, q, categoryId, limit }) {
  const { DocumentItem, Category, ContentAudienceRule } = require('../../database/models');

  const where = {
    status: 'PUBLISHED',
    deleted_at: null,
    ...ilikeAny(['title', 'summary'], q),
  };
  if (categoryId) where.category_id = Number(categoryId);

  const rows = await DocumentItem.findAll({
    where,
    attributes: ['document_item_id', 'title', 'summary', 'published_at', 'category_id'],
    include: [
      { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
      { model: ContentAudienceRule, as: 'audienceRules', where: { entity_type: 'DOCUMENT' }, required: false },
    ],
    order: [['published_at', 'DESC']],
    limit: limit * 2,
  });

  const userKeys = await audienceService.getUserAudienceScopeKeys(userId, 'documents');
  return rows
    .filter((row) => audienceService.matchesAudience(row.audienceRules, userKeys))
    .slice(0, limit)
    .map((row) => ({
      id: row.document_item_id,
      title: row.title,
      summary: row.summary,
      published_at: row.published_at,
      category: row.category ? {
        category_id: row.category.category_id,
        name: row.category.name,
        slug: row.category.slug,
      } : null,
    }));
}

// ── Contacts ───────────────────────────────────────────────────────────────

// Public directory search. Returns minimal projection (name + job title +
// dept + avatar). No email/phone — matches the Key Contacts card on the
// home page.
async function searchContacts({ q, limit }) {
  const {
    UserAccount, PersonProfile, DepartmentMembership, Department,
  } = require('../../database/models');

  // Two-step: ILIKE on UserAccount fields OR PersonProfile.job_title.
  // Sequelize literal subqueries get awkward across associations, so we
  // run two narrower queries and merge in JS.
  const baseAttrs = ['user_id', 'first_name', 'last_name', 'avatar_url'];
  const baseWhere = { status: 'ACTIVE', deleted_at: null };

  const byNameOrEmail = await UserAccount.findAll({
    where: {
      ...baseWhere,
      ...ilikeAny(['first_name', 'last_name', 'email'], q),
    },
    attributes: baseAttrs,
    limit: limit * 2,
  });

  const byJobTitle = await UserAccount.findAll({
    where: baseWhere,
    attributes: baseAttrs,
    include: [{
      model: PersonProfile,
      as: 'profile',
      where: { job_title: { [Op.iLike]: `%${q}%` } },
      required: true,
      attributes: ['job_title'],
    }],
    limit: limit * 2,
  });

  // Merge + dedupe by user_id, preserving order (name matches first).
  const seen = new Set();
  const merged = [];
  for (const list of [byNameOrEmail, byJobTitle]) {
    for (const u of list) {
      if (seen.has(u.user_id)) continue;
      seen.add(u.user_id);
      merged.push(u);
      if (merged.length >= limit) break;
    }
    if (merged.length >= limit) break;
  }

  if (merged.length === 0) return [];

  // Hydrate job_title + department_name in one extra pass.
  const userIds = merged.map((u) => u.user_id);
  const [profiles, memberships] = await Promise.all([
    PersonProfile.findAll({
      where: { user_id: userIds },
      attributes: ['user_id', 'job_title'],
    }),
    DepartmentMembership.findAll({
      where: { user_id: userIds },
      attributes: ['user_id', 'department_id', 'is_primary'],
      include: [{ model: Department, as: 'department', attributes: ['id', 'name'], required: false }],
      order: [['is_primary', 'DESC'], ['joined_at', 'ASC']],
    }),
  ]);

  const jobTitleByUser = new Map(profiles.map((p) => [p.user_id, p.job_title]));
  const primaryDeptByUser = new Map();
  for (const m of memberships) {
    if (!primaryDeptByUser.has(m.user_id)) {
      primaryDeptByUser.set(m.user_id, m.department?.name || null);
    }
  }

  return merged.map((u) => ({
    user_id: u.user_id,
    first_name: u.first_name,
    last_name: u.last_name,
    avatar_url: u.avatar_url || null,
    job_title: jobTitleByUser.get(u.user_id) || null,
    department_name: primaryDeptByUser.get(u.user_id) || null,
  }));
}

// ── Public service ─────────────────────────────────────────────────────────

const searchService = {
  async search({ userId, q, type = 'all', categoryId = null, limit }) {
    const cleanQ = (q || '').trim();
    const lim = Math.max(1, Math.min(MAX_LIMIT, Number.isInteger(Number(limit)) ? Number(limit) : DEFAULT_LIMIT));

    // Empty query → empty results. Clients use this to skip a network call
    // (we still answer politely so the contract is consistent).
    if (!cleanQ) {
      return {
        query: '',
        results: { news: [], documents: [], contacts: [] },
        total: 0,
        limits: { news: lim, documents: lim, contacts: lim },
      };
    }

    const wantsNews = type === 'all' || type === 'news';
    const wantsDocs = type === 'all' || type === 'document';
    // People/member search is disabled for employees — contacts stay empty.
    const wantsPeople = false;

    try {
      const [news, documents, contacts] = await Promise.all([
        wantsNews     ? searchNews({ userId, q: cleanQ, categoryId, limit: lim })      : Promise.resolve([]),
        wantsDocs     ? searchDocuments({ userId, q: cleanQ, categoryId, limit: lim }) : Promise.resolve([]),
        wantsPeople   ? searchContacts({ q: cleanQ, limit: lim })                      : Promise.resolve([]),
      ]);

      return {
        query: cleanQ,
        results: { news, documents, contacts },
        total: news.length + documents.length + contacts.length,
        limits: { news: lim, documents: lim, contacts: lim },
      };
    } catch (err) {
      logger.error(`search error: ${err.message}`);
      return {
        query: cleanQ,
        results: { news: [], documents: [], contacts: [] },
        total: 0,
        limits: { news: lim, documents: lim, contacts: lim },
        error: 'Search failed',
      };
    }
  },
};

module.exports = searchService;
