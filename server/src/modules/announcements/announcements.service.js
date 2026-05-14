const { Op } = require('sequelize');
const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const audienceService = require('../../services/audience.service');
const scopeVisibilityService = require('../../services/scope-visibility.service');
const { assertAudienceWithinUserScope } = require('../../services/publishing-scope.service');
const { sanitiseRichText } = require('../../utils/sanitiseRichText');

// Announcement admin permissions piggy-back on the existing NEWS module so
// OWNER / OFFICE_MANAGER / CONTENT_EDITOR roles work without re-seeding. The
// audience model uses 'ANNOUNCEMENT' as the polymorphic entity_type.
const AUTH_MODULE = 'NEWS';

async function canManage(userId) {
  const [c, e, d, p] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, AUTH_MODULE, 'CREATE'),
    permissionService.hasPermissionAnywhere(userId, AUTH_MODULE, 'EDIT'),
    permissionService.hasPermissionAnywhere(userId, AUTH_MODULE, 'DELETE'),
    permissionService.hasPermissionAnywhere(userId, AUTH_MODULE, 'PUBLISH'),
  ]);
  return c || e || d || p;
}

const getUserAudienceScopeKeys = (userId) =>
  audienceService.getUserAudienceScopeKeys(userId, 'announcements');

const matchesAudience = (item, keys) =>
  audienceService.matchesAudience(item.audienceRules, keys);

function buildAdminOrder(sequelize, trash) {
  return [
    [
      sequelize.literal(`CASE
        WHEN "AnnouncementItem"."status" = 'PUBLISHED' THEN 0
        WHEN "AnnouncementItem"."status" = 'ARCHIVED' THEN 1
        WHEN "AnnouncementItem"."status" = 'DRAFT' THEN 2
        ELSE 3
      END`),
      'ASC',
    ],
    [trash ? 'deleted_at' : 'created_at', 'DESC'],
  ];
}

const announcementsService = {
  async list(query, userId) {
    const { AnnouncementItem, UserAccount, ContentAudienceRule, sequelize } = require('../../database/models');
    const { page, limit, offset } = parsePagination(query);
    const [managing, isGlobal] = await Promise.all([
      canManage(userId),
      permissionService.isGlobalManager(userId, AUTH_MODULE),
    ]);
    const trash = managing && (query.trash === true || query.trash === 'true');

    const where = trash ? { deleted_at: { [Op.ne]: null } } : { deleted_at: null };

    if (managing) {
      if (query.status) where.status = query.status;
      if (!isGlobal) {
        const readableKeys = await scopeVisibilityService.getReadableScopeKeys(userId, AUTH_MODULE);
        const orCondition = scopeVisibilityService.buildOwningScopeOrCondition(readableKeys);
        if (orCondition && orCondition.length === 0) {
          return {
            announcements: [],
            pagination: buildPagination(page, limit, 0),
            status_counts: { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 },
          };
        } else if (orCondition) {
          where[Op.and] = [...(where[Op.and] || []), { [Op.or]: orCondition }];
        }
      }
    } else {
      if (query.status && query.status !== 'PUBLISHED') {
        return { announcements: [], pagination: buildPagination(page, limit, 0) };
      }
      where.status = 'PUBLISHED';
    }

    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];
    const include = [{ model: UserAccount, as: 'author', attributes: userAttrs }];

    if (managing) {
      include.push(
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'publisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'unpublisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'archiver', attributes: userAttrs, required: false },
      );
    } else {
      include.push({
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'ANNOUNCEMENT' },
        required: false,
      });
    }

    if (managing) {
      const countWhere = { ...where };
      delete countWhere.status;
      const Model = trash ? AnnouncementItem.unscoped() : AnnouncementItem;

      const [{ rows, count }, statusBreakdown] = await Promise.all([
        Model.findAndCountAll({
          where,
          limit,
          offset,
          include,
          order: buildAdminOrder(sequelize, trash),
        }),
        Model.findAll({
          where: countWhere,
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('announcement_item_id')), 'count']],
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
        announcements: rows,
        pagination: buildPagination(page, limit, count),
        status_counts: statusCounts,
      };
    }

    const userKeys = await getUserAudienceScopeKeys(userId);
    const rows = await AnnouncementItem.findAll({
      where,
      include,
      order: [['published_at', 'DESC'], ['created_at', 'DESC']],
    });
    const visible = rows.filter((r) => matchesAudience(r, userKeys));
    const paginated = visible.slice(offset, offset + limit);

    return {
      announcements: paginated,
      pagination: buildPagination(page, limit, visible.length),
      status_counts: {
        ALL: visible.length,
        DRAFT: 0,
        PUBLISHED: visible.length,
        ARCHIVED: 0,
      },
    };
  },

  async getById(id, userId = null) {
    const { AnnouncementItem, UserAccount, ContentAudienceRule } = require('../../database/models');
    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];

    const item = await AnnouncementItem.findByPk(id, {
      include: [
        { model: UserAccount, as: 'author', attributes: userAttrs },
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'publisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'unpublisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'archiver', attributes: userAttrs, required: false },
        {
          model: ContentAudienceRule,
          as: 'audienceRules',
          where: { entity_type: 'ANNOUNCEMENT' },
          required: false,
        },
      ],
    });

    if (!item) throw ApiError.notFound('Announcement not found');

    if (userId) {
      const managing = await canManage(userId);
      if (!managing) {
        if (item.status !== 'PUBLISHED') throw ApiError.notFound('Announcement not found');
        const keys = await getUserAudienceScopeKeys(userId);
        if (!matchesAudience(item, keys)) throw ApiError.notFound('Announcement not found');
      }
    }

    return item;
  },

  async listMarquee(userId) {
    const { AnnouncementItem, ContentAudienceRule } = require('../../database/models');
    const now = new Date();
    const rows = await AnnouncementItem.findAll({
      where: {
        status: 'PUBLISHED',
        show_in_marquee: true,
        deleted_at: null,
        [Op.and]: [
          { [Op.or]: [{ marquee_starts_at: null }, { marquee_starts_at: { [Op.lte]: now } }] },
          { [Op.or]: [{ marquee_ends_at: null }, { marquee_ends_at: { [Op.gt]: now } }] },
        ],
      },
      include: [{
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'ANNOUNCEMENT' },
        required: false,
      }],
      order: [
        // URGENT > HIGH > NORMAL > LOW
        [
          require('../../database/models').sequelize.literal(`CASE
            WHEN "AnnouncementItem"."priority" = 'URGENT' THEN 0
            WHEN "AnnouncementItem"."priority" = 'HIGH' THEN 1
            WHEN "AnnouncementItem"."priority" = 'NORMAL' THEN 2
            WHEN "AnnouncementItem"."priority" = 'LOW' THEN 3
            ELSE 4
          END`),
          'ASC',
        ],
        ['published_at', 'DESC'],
      ],
      limit: 20,
    });

    const keys = await getUserAudienceScopeKeys(userId);
    const visible = rows.filter((r) => matchesAudience(r, keys));
    return {
      items: visible.slice(0, 10).map((r) => ({
        announcement_item_id: r.announcement_item_id,
        title: r.title,
        priority: r.priority,
      })),
    };
  },

  async create(data, authorId) {
    const { AnnouncementItem, ContentAudienceRule, sequelize } = require('../../database/models');
    await assertAudienceWithinUserScope(authorId, data.audience_targets || []);

    const tx = await sequelize.transaction();
    try {
      const item = await AnnouncementItem.create({
        tenant_id: DEFAULT_TENANT_ID,
        title: data.title,
        body: sanitiseRichText(data.body || ''),
        status: 'DRAFT',
        priority: data.priority || 'NORMAL',
        show_in_marquee: data.show_in_marquee || false,
        marquee_starts_at: data.marquee_starts_at || null,
        marquee_ends_at: data.marquee_ends_at || null,
        author_id: authorId,
        owning_scope_type: data.owning_scope_type || 'ORGANISATION',
        owning_scope_id: data.owning_scope_id,
      }, { transaction: tx });

      const rules = (data.audience_targets || []).map((t) => ({
        entity_type: 'ANNOUNCEMENT',
        entity_id: item.announcement_item_id,
        target_scope_type: t.scope_type || 'ORGANISATION',
        target_scope_id: t.scope_id,
      }));
      if (rules.length > 0) await ContentAudienceRule.bulkCreate(rules, { transaction: tx });

      await auditService.log({
        user_id: authorId,
        action: 'ANNOUNCEMENT_CREATED',
        resource_type: 'AnnouncementItem',
        resource_id: item.announcement_item_id,
        details: { title: data.title },
      });

      await tx.commit();
      return this.getById(item.announcement_item_id, authorId);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async update(id, data, userId) {
    const { AnnouncementItem, ContentAudienceRule, sequelize } = require('../../database/models');
    if (Array.isArray(data.audience_targets)) {
      await assertAudienceWithinUserScope(userId, data.audience_targets);
    }

    const tx = await sequelize.transaction();
    try {
      const item = await AnnouncementItem.findByPk(id, { transaction: tx });
      if (!item) throw ApiError.notFound('Announcement not found');

      const fields = ['title', 'priority', 'show_in_marquee', 'marquee_starts_at', 'marquee_ends_at'];
      fields.forEach((f) => { if (data[f] !== undefined) item[f] = data[f]; });
      if (data.body !== undefined) item.body = sanitiseRichText(data.body || '');

      item.updated_by = userId;
      await item.save({ transaction: tx });

      if (Array.isArray(data.audience_targets)) {
        await ContentAudienceRule.destroy({
          where: { entity_type: 'ANNOUNCEMENT', entity_id: id },
          transaction: tx,
        });
        if (data.audience_targets.length > 0) {
          await ContentAudienceRule.bulkCreate(data.audience_targets.map((t) => ({
            entity_type: 'ANNOUNCEMENT',
            entity_id: id,
            target_scope_type: t.scope_type || 'ORGANISATION',
            target_scope_id: t.scope_id,
          })), { transaction: tx });
        }
      }

      await auditService.log({
        user_id: userId,
        action: 'ANNOUNCEMENT_UPDATED',
        resource_type: 'AnnouncementItem',
        resource_id: id,
      });

      await tx.commit();
      return this.getById(id, userId);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async delete(id, userId) {
    const { AnnouncementItem } = require('../../database/models');
    const item = await AnnouncementItem.findByPk(id);
    if (!item) throw ApiError.notFound('Announcement not found');
    if (item.status === 'PUBLISHED') {
      throw ApiError.badRequest('Archive this announcement before moving it to the trash');
    }
    await item.update({ deleted_at: new Date(), deleted_by: userId });
    await auditService.log({
      user_id: userId,
      action: 'ANNOUNCEMENT_TRASHED',
      resource_type: 'AnnouncementItem',
      resource_id: id,
    });
    return { message: 'Announcement moved to trash' };
  },

  async publish(id, userId) {
    const { AnnouncementItem, ContentAudienceRule } = require('../../database/models');
    const item = await AnnouncementItem.findByPk(id);
    if (!item) throw ApiError.notFound('Announcement not found');
    if (item.status === 'PUBLISHED') throw ApiError.badRequest('Announcement is already published');

    await item.update({
      status: 'PUBLISHED',
      published_at: new Date(),
      published_by: userId,
      unpublished_at: null,
      unpublished_by: null,
    });

    await auditService.log({
      user_id: userId,
      action: 'ANNOUNCEMENT_PUBLISHED',
      resource_type: 'AnnouncementItem',
      resource_id: id,
    });

    // Fan notifications out to the audience. Fire-and-forget.
    try {
      const audienceRules = await ContentAudienceRule.findAll({
        where: { entity_type: 'ANNOUNCEMENT', entity_id: id },
      });
      const notificationService = require('../notifications/notifications.service');
      const logger = require('../../config/logger');
      notificationService
        .notifyOnPublish({
          type: 'ANNOUNCEMENT',
          entity: { id, title: item.title, summary: null },
          audienceRules,
          entityKey: 'announcements',
        })
        .catch((err) => logger.error(`notifyOnPublish (ANNOUNCEMENT ${id}) rejected: ${err.message}`));
    } catch (_) {
      // Notification pipeline may not yet know about ANNOUNCEMENT type; do not
      // fail publish on that account.
    }

    return this.getById(id);
  },

  async createAndPublish(data, userId) {
    const created = await this.create(data, userId);
    try {
      return await this.publish(created.announcement_item_id, userId);
    } catch (err) {
      try { await this.delete(created.announcement_item_id, userId); } catch (_) {}
      throw err;
    }
  },

  async archive(id, userId) {
    const { AnnouncementItem } = require('../../database/models');
    const item = await AnnouncementItem.findByPk(id);
    if (!item) throw ApiError.notFound('Announcement not found');
    await item.update({ status: 'ARCHIVED', archived_at: new Date(), archived_by: userId });
    await auditService.log({
      user_id: userId,
      action: 'ANNOUNCEMENT_ARCHIVED',
      resource_type: 'AnnouncementItem',
      resource_id: id,
    });
    return this.getById(id);
  },

  async unpublish(id, userId) {
    const { AnnouncementItem } = require('../../database/models');
    const item = await AnnouncementItem.findByPk(id);
    if (!item) throw ApiError.notFound('Announcement not found');
    if (item.status !== 'PUBLISHED') {
      throw ApiError.badRequest('Only published announcements can be unpublished');
    }
    await item.update({ status: 'DRAFT', unpublished_at: new Date(), unpublished_by: userId });
    await auditService.log({
      user_id: userId,
      action: 'ANNOUNCEMENT_UNPUBLISHED',
      resource_type: 'AnnouncementItem',
      resource_id: id,
    });
    return this.getById(id);
  },

  async setAudience(id, targets, userId) {
    const { ContentAudienceRule, sequelize } = require('../../database/models');
    await assertAudienceWithinUserScope(userId, targets || []);
    const tx = await sequelize.transaction();
    try {
      await ContentAudienceRule.destroy({
        where: { entity_type: 'ANNOUNCEMENT', entity_id: id },
        transaction: tx,
      });
      const rules = (targets || []).map((t) => ({
        entity_type: 'ANNOUNCEMENT',
        entity_id: id,
        target_scope_type: t.scope_type || 'ORGANISATION',
        target_scope_id: t.scope_id,
      }));
      await ContentAudienceRule.bulkCreate(rules, { transaction: tx });
      await tx.commit();
      return this.getById(id);
    } catch (err) {
      await tx.rollback();
      throw err;
    }
  },

  async bulkRestore(ids, userId) {
    const { AnnouncementItem } = require('../../database/models');
    const items = await AnnouncementItem.unscoped().findAll({
      where: { announcement_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });
    let restored = 0;
    for (const item of items) {
      await item.update({ deleted_at: null });
      restored += 1;
    }
    if (restored > 0) {
      await auditService.log({
        user_id: userId,
        action: 'ANNOUNCEMENT_RESTORED',
        resource_type: 'AnnouncementItem',
        resource_id: items[0]?.announcement_item_id || null,
        details: { count: restored },
      });
    }
    return { restored };
  },

  async bulkPurge(ids, userId) {
    const { AnnouncementItem, ContentAudienceRule } = require('../../database/models');
    const items = await AnnouncementItem.unscoped().findAll({
      where: { announcement_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });
    let purged = 0;
    for (const item of items) {
      await ContentAudienceRule.destroy({
        where: { entity_type: 'ANNOUNCEMENT', entity_id: item.announcement_item_id },
      });
      await item.destroy({ force: true });
      purged += 1;
    }
    if (purged > 0) {
      await auditService.log({
        user_id: userId,
        action: 'ANNOUNCEMENT_PURGED',
        resource_type: 'AnnouncementItem',
        resource_id: null,
        details: { count: purged },
      });
    }
    return { purged };
  },
};

module.exports = announcementsService;
