const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

function slugify(input) {
  return String(input || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 290);
}

async function loadCategoryUsage(ids, entityType) {
  if (!ids.length) return new Map();
  const { DocumentItem, NewsItem, sequelize } = require('../../database/models');
  const Model = entityType === 'NEWS' ? NewsItem : DocumentItem;

  const rows = await Model.findAll({
    where: { category_id: { [Op.in]: ids } },
    attributes: ['category_id', [sequelize.fn('COUNT', sequelize.col('category_id')), 'count']],
    group: ['category_id'],
    raw: true,
  });

  const map = new Map();
  rows.forEach((r) => map.set(Number(r.category_id), Number(r.count)));
  return map;
}

function actorPayload(user) {
  if (!user) return null;
  return {
    user_id: user.user_id,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
  };
}

function serialize(cat, itemCount = 0) {
  return {
    category_id: cat.category_id,
    entity_type: cat.entity_type,
    name: cat.name,
    slug: cat.slug,
    description: cat.description,
    parent_category_id: cat.parent_category_id,
    parent: cat.parent
      ? { category_id: cat.parent.category_id, name: cat.parent.name, slug: cat.parent.slug }
      : null,
    sort_order: cat.sort_order,
    item_count: itemCount,
    deleted_at: cat.deleted_at,
    created_at: cat.createdAt,
    updated_at: cat.updatedAt,
    creator: actorPayload(cat.creator),
    updater: actorPayload(cat.updater),
    deleter: actorPayload(cat.deleter),
  };
}

async function ensureSlugAvailable({ slug, entityType, excludeId }) {
  const { Category } = require('../../database/models');
  const where = {
    tenant_id: DEFAULT_TENANT_ID,
    entity_type: entityType,
    slug,
    deleted_at: null,
  };
  if (excludeId) where.category_id = { [Op.ne]: excludeId };
  const clash = await Category.findOne({ where });
  if (clash) {
    throw ApiError.badRequest(`A category with slug "${slug}" already exists in this tab`);
  }
}

async function ensureNotDescendant(parentId, candidateAncestorId) {
  // Walk up parentId's ancestor chain. If we hit candidateAncestorId we'd
  // create a cycle. Bounded by a reasonable depth.
  if (!parentId) return;
  if (parentId === candidateAncestorId) {
    throw ApiError.badRequest('A category cannot be its own parent');
  }
  const { Category } = require('../../database/models');
  let cursor = parentId;
  for (let i = 0; i < 50 && cursor; i += 1) {
    const node = await Category.findByPk(cursor, { attributes: ['category_id', 'parent_category_id'] });
    if (!node) return;
    if (node.parent_category_id === candidateAncestorId) {
      throw ApiError.badRequest('Cannot make a descendant the parent — would create a cycle');
    }
    cursor = node.parent_category_id;
  }
}

const categoriesService = {
  async list(query, userId) {
    const { Category } = require('../../database/models');
    const permissionService = require('../../services/permission.service');
    const { page, limit, offset } = parsePagination(query);

    const trash = query.trash === true || query.trash === 'true';
    const where = {
      entity_type: query.entity_type,
    };
    where.deleted_at = trash ? { [Op.ne]: null } : null;
    if (query.search) {
      where.name = { [Op.iLike]: `%${query.search}%` };
    }

    // Non-global users see categories created by anyone in their scope
    // overlap (same-scope-or-descendants collaboration). Global = Owner
    // or ORG-scope manager in the matching module.
    if (userId) {
      const moduleCode = query.entity_type === 'NEWS' ? 'NEWS' : 'DOCUMENTS';
      const isGlobal = await permissionService.isGlobalManager(userId, moduleCode);
      if (!isGlobal) {
        const scopeVisibilityService = require('../../services/scope-visibility.service');
        const peerUserIds = await scopeVisibilityService.getCollaboratorUserIds(userId, [moduleCode]);
        if (peerUserIds !== null) {
          where.creator_id = { [Op.in]: peerUserIds };
        }
      }
    }

    const order = trash
      ? [['deleted_at', 'DESC']]
      : [['sort_order', 'ASC'], ['name', 'ASC']];

    const { UserAccount } = require('../../database/models');
    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];
    const Model = trash ? Category.unscoped() : Category;
    const { rows, count } = await Model.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        {
          model: Category.unscoped(),
          as: 'parent',
          attributes: ['category_id', 'name', 'slug'],
          required: false,
        },
        { model: UserAccount, as: 'creator', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'deleter', attributes: userAttrs, required: false },
      ],
    });

    const ids = rows.map((r) => r.category_id);
    const usage = await loadCategoryUsage(ids, query.entity_type);

    return {
      categories: rows.map((cat) => serialize(cat, usage.get(cat.category_id) || 0)),
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const { Category } = require('../../database/models');
    const cat = await Category.unscoped().findByPk(id, {
      include: [{
        model: Category.unscoped(),
        as: 'parent',
        attributes: ['category_id', 'name', 'slug'],
        required: false,
      }],
    });
    if (!cat) throw ApiError.notFound('Category not found');
    return cat;
  },

  async create(data, userId) {
    const { Category } = require('../../database/models');
    const slug = slugify(data.slug || data.name);
    if (!slug) throw ApiError.badRequest('Slug cannot be empty');

    if (data.parent_category_id) {
      const parent = await Category.findByPk(data.parent_category_id);
      if (!parent || parent.entity_type !== data.entity_type) {
        throw ApiError.badRequest('Parent category not found in this tab');
      }
    }

    await ensureSlugAvailable({ slug, entityType: data.entity_type });

    const cat = await Category.create({
      tenant_id: DEFAULT_TENANT_ID,
      entity_type: data.entity_type,
      name: data.name,
      slug,
      description: data.description || null,
      parent_category_id: data.parent_category_id || null,
      sort_order: data.sort_order || 0,
      creator_id: userId || null,
    });

    return serialize(cat, 0);
  },

  async update(id, data, userId) {
    const { Category } = require('../../database/models');
    const cat = await Category.findByPk(id);
    if (!cat) throw ApiError.notFound('Category not found');

    if (data.parent_category_id !== undefined) {
      if (data.parent_category_id === null) {
        cat.parent_category_id = null;
      } else {
        const parent = await Category.findByPk(data.parent_category_id);
        if (!parent || parent.entity_type !== cat.entity_type) {
          throw ApiError.badRequest('Parent category not found in this tab');
        }
        await ensureNotDescendant(data.parent_category_id, cat.category_id);
        cat.parent_category_id = data.parent_category_id;
      }
    }

    if (data.name !== undefined) cat.name = data.name;
    if (data.description !== undefined) cat.description = data.description || null;
    if (data.sort_order !== undefined) cat.sort_order = data.sort_order;

    if (data.slug !== undefined && data.slug !== null && data.slug !== '') {
      const nextSlug = slugify(data.slug);
      if (nextSlug !== cat.slug) {
        await ensureSlugAvailable({ slug: nextSlug, entityType: cat.entity_type, excludeId: cat.category_id });
        cat.slug = nextSlug;
      }
    } else if (data.name !== undefined && data.slug === undefined) {
      // Auto-regenerate slug from name when slug not explicitly provided
      const nextSlug = slugify(data.name);
      if (nextSlug && nextSlug !== cat.slug) {
        await ensureSlugAvailable({ slug: nextSlug, entityType: cat.entity_type, excludeId: cat.category_id });
        cat.slug = nextSlug;
      }
    }

    if (userId) cat.updated_by = userId;
    await cat.save();
    return serialize(cat);
  },

  async softDelete(id, userId) {
    const { Category } = require('../../database/models');
    const cat = await Category.findByPk(id);
    if (!cat) throw ApiError.notFound('Category not found');

    await cat.update({ deleted_at: new Date(), deleted_by: userId || null });
    return { message: 'Category moved to trash' };
  },

  async bulkRestore(ids, entityType) {
    const { Category } = require('../../database/models');
    const rows = await Category.unscoped().findAll({
      where: {
        category_id: { [Op.in]: ids },
        entity_type: entityType,
        deleted_at: { [Op.ne]: null },
      },
    });

    let restored = 0;
    for (const row of rows) {
      // If a restored category's slug now collides with a live one, append a suffix.
      const collision = await Category.findOne({
        where: {
          tenant_id: row.tenant_id,
          entity_type: row.entity_type,
          slug: row.slug,
          deleted_at: null,
          category_id: { [Op.ne]: row.category_id },
        },
      });
      if (collision) {
        row.slug = `${row.slug}-${row.category_id}`;
      }
      await row.update({ deleted_at: null, slug: row.slug });
      restored += 1;
    }

    return { restored };
  },
};

module.exports = categoriesService;
