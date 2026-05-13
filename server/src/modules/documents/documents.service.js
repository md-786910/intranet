const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const audienceService = require('../../services/audience.service');
const scopeVisibilityService = require('../../services/scope-visibility.service');
const { assertAudienceWithinUserScope } = require('../../services/publishing-scope.service');

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

// Normalise the `files` array onto a single representative legacy {file_url,
// file_name, file_size, mime_type} so legacy reads still see a primary file.
function buildVersionFileFields(data) {
  let files = Array.isArray(data.files) && data.files.length > 0 ? data.files : null;
  if (!files && data.file_url) {
    files = [{
      url: data.file_url,
      name: data.file_name || data.file_url.split('/').pop() || 'file',
      size: data.file_size || null,
      mime: data.mime_type || null,
      source: data.media_asset_id ? 'upload' : 'url',
    }];
  }
  if (!files) files = [];

  // Sanitise — keep only the documented keys and coerce numbers.
  files = files.map((f) => ({
    url: f.url,
    name: f.name,
    size: f.size != null ? Number(f.size) : null,
    mime: f.mime || null,
    source: f.source || 'url',
  }));

  const head = files[0] || null;
  return {
    files,
    file_url: head ? head.url : (data.file_url || ''),
    file_name: head ? head.name : (data.file_name || 'file'),
    file_size: head ? head.size : (data.file_size || null),
    mime_type: head ? head.mime : (data.mime_type || null),
  };
}

async function canManageDocuments(userId) {
  const [canCreate, canEdit, canDelete, canPublish] = await Promise.all([
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'CREATE'),
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'EDIT'),
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'DELETE'),
    permissionService.hasPermissionAnywhere(userId, 'DOCUMENTS', 'PUBLISH'),
  ]);

  return canCreate || canEdit || canDelete || canPublish;
}

const getUserAudienceScopeKeys = (userId) => audienceService.getUserAudienceScopeKeys(userId, 'documents');
const documentMatchesAudience = (doc, userAudienceScopeKeys) =>
  audienceService.matchesAudience(doc.audienceRules, userAudienceScopeKeys);

// Returns the published, audience-visible documents (with category +
// audienceRules eager-loaded) for a given user. Used by the dashboard widgets.
async function getVisibleDocumentsForUser(userId, { extraInclude = [] } = {}) {
  const { DocumentItem, Category, ContentAudienceRule } = require('../../database/models');

  const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
  const docs = await DocumentItem.findAll({
    where: { deleted_at: null, status: 'PUBLISHED' },
    include: [
      { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
      { model: ContentAudienceRule, as: 'audienceRules', where: { entity_type: 'DOCUMENT' }, required: false },
      ...extraInclude,
    ],
    order: [['created_at', 'DESC']],
  });

  return docs.filter((doc) => documentMatchesAudience(doc, userAudienceScopeKeys));
}

const documentsService = {
  async list(query, userId) {
    const { DocumentItem, UserAccount, Category, ContentAudienceRule } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);
    const [managing, isGlobal] = await Promise.all([
      canManageDocuments(userId),
      permissionService.isGlobalManager(userId, 'DOCUMENTS'),
    ]);
    const trash = managing && (query.trash === true || query.trash === 'true');

    const where = trash
      ? { deleted_at: { [Op.ne]: null } }
      : { deleted_at: null };
    if (managing) {
      if (query.status) where.status = query.status;
      // Scoped manager sees documents whose owning_scope matches one of
      // their role-assignment scopes OR is a descendant. Two editors at
      // the same scope see each other's docs.
      if (!isGlobal) {
        const readableKeys = await scopeVisibilityService.getReadableScopeKeys(userId, 'DOCUMENTS');
        const orCondition = scopeVisibilityService.buildOwningScopeOrCondition(readableKeys);
        if (orCondition === null) {
          // global passthrough
        } else if (orCondition.length === 0) {
          return {
            documents: [],
            pagination: buildPagination(page, limit, 0),
            status_counts: { ALL: 0, DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 },
          };
        } else {
          where[Op.and] = [...(where[Op.and] || []), { [Op.or]: orCondition }];
        }
      }
    } else {
      if (query.status && query.status !== 'PUBLISHED') {
        return {
          documents: [],
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
    // priority — accept array, comma-separated string, or single value
    const priorities = (() => {
      if (!query.priority) return null;
      if (Array.isArray(query.priority)) return query.priority;
      return String(query.priority).split(',').map((s) => s.trim()).filter(Boolean);
    })();
    if (priorities && priorities.length > 0) {
      where.priority = { [Op.in]: priorities };
    }

    // mime_prefix — applied JS-side after fetch since the file lives on the
    // latest DocumentVersion (one-to-many).
    const mimePrefixes = (() => {
      if (!query.mime_prefix) return null;
      const arr = Array.isArray(query.mime_prefix) ? query.mime_prefix : [query.mime_prefix];
      return arr.map((s) => String(s).toLowerCase()).filter(Boolean);
    })();

    const { DocumentVersion } = require('../../database/models');
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
      );
    }

    if (!managing) {
      include.push({
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'DOCUMENT' },
        required: false,
      });
      include.push({
        model: DocumentVersion,
        as: 'versions',
        attributes: ['document_version_id', 'version_no', 'file_name', 'file_size', 'mime_type', 'file_url', 'files'],
        required: false,
        separate: true,
        order: [['version_no', 'DESC']],
        limit: 1,
      });
    }

    if (managing) {
      // Counts are scoped by the same filters (search/category/etc.) MINUS the
      // status filter, so each tab shows what you'd get if you clicked it.
      const { sequelize } = require('../../database/models');
      const countWhere = { ...where };
      delete countWhere.status;

      const Model = trash ? DocumentItem.unscoped() : DocumentItem;
      const [{ rows, count }, statusBreakdown] = await Promise.all([
        Model.findAndCountAll({
          where,
          limit,
          offset,
          include,
          order: trash
            ? [['deleted_at', 'DESC']]
            : [['created_at', 'DESC']],
        }),
        Model.findAll({
          where: countWhere,
          attributes: ['status', [sequelize.fn('COUNT', sequelize.col('document_item_id')), 'count']],
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
        documents: rows,
        pagination: buildPagination(page, limit, count),
        status_counts: statusCounts,
      };
    }

    const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
    const rows = await DocumentItem.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });

    let visibleDocuments = rows.filter((doc) => documentMatchesAudience(doc, userAudienceScopeKeys));
    if (mimePrefixes && mimePrefixes.length > 0) {
      visibleDocuments = visibleDocuments.filter((doc) => {
        const mime = (doc.versions?.[0]?.mime_type || '').toLowerCase();
        if (!mime) return false;
        return mimePrefixes.some((p) => mime.startsWith(p));
      });
    }
    const paginatedDocuments = visibleDocuments.slice(offset, offset + limit);

    return {
      documents: paginatedDocuments,
      pagination: buildPagination(page, limit, visibleDocuments.length),
      // Non-managers only ever see PUBLISHED, so other tabs are 0.
      status_counts: {
        ALL: visibleDocuments.length,
        DRAFT: 0,
        PUBLISHED: visibleDocuments.length,
        ARCHIVED: 0,
      },
    };
  },

  async getById(id, userId = null) {
    const { DocumentItem, UserAccount, Category, DocumentVersion, ContentAudienceRule, MediaAsset } = require('../../database/models');

    const userAttrs = ['user_id', 'first_name', 'last_name', 'email'];
    const doc = await DocumentItem.findByPk(id, {
      include: [
        { model: UserAccount, as: 'author', attributes: userAttrs },
        { model: UserAccount, as: 'updater', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'publisher', attributes: userAttrs, required: false },
        { model: UserAccount, as: 'unpublisher', attributes: userAttrs, required: false },
        { model: Category, as: 'category', required: false },
        {
          model: DocumentVersion,
          as: 'versions',
          order: [['version_no', 'DESC']],
          include: [
            { model: UserAccount, as: 'uploader', attributes: ['user_id', 'first_name', 'last_name'] },
            { model: MediaAsset, as: 'media', required: false },
          ],
        },
        {
          model: ContentAudienceRule,
          as: 'audienceRules',
          where: { entity_type: 'DOCUMENT' },
          required: false,
        },
      ],
    });

    if (!doc) throw ApiError.notFound('Document not found');

    if (userId) {
      const managing = await canManageDocuments(userId);
      if (!managing) {
        if (doc.status !== 'PUBLISHED') throw ApiError.notFound('Document not found');

        const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
        if (!documentMatchesAudience(doc, userAudienceScopeKeys)) {
          throw ApiError.notFound('Document not found');
        }
      }
    }

    return doc;
  },

  async create(data, authorId) {
    const { DocumentItem, DocumentVersion, ContentAudienceRule, sequelize } = require('../../database/models');

    await assertAudienceWithinUserScope(authorId, data.audience_targets || []);

    const transaction = await sequelize.transaction();

    try {
      const slug = generateSlug(data.title) + '-' + Date.now();

      const doc = await DocumentItem.create({
        tenant_id: DEFAULT_TENANT_ID,
        title: data.title,
        slug,
        summary: data.summary || null,
        category_id: data.category_id || null,
        priority: data.priority || 'NORMAL',
        status: 'DRAFT',
        author_id: authorId,
        owning_scope_type: data.owning_scope_type || 'ORGANISATION',
        owning_scope_id: data.owning_scope_id,
      }, { transaction });

      // Create initial version
      const versionFiles = buildVersionFileFields(data);
      await DocumentVersion.create({
        document_item_id: doc.document_item_id,
        version_no: 1,
        files: versionFiles.files,
        file_url: versionFiles.file_url,
        file_name: versionFiles.file_name,
        file_size: versionFiles.file_size,
        mime_type: versionFiles.mime_type,
        changelog: data.changelog || 'Initial version',
        uploaded_by: authorId,
      }, { transaction });

      const audienceRules = (data.audience_targets || []).map((target) => ({
        entity_type: 'DOCUMENT',
        entity_id: doc.document_item_id,
        target_scope_type: target.scope_type || 'ORGANISATION',
        target_scope_id: target.scope_id,
      }));

      if (audienceRules.length > 0) {
        await ContentAudienceRule.bulkCreate(audienceRules, { transaction });
      }

      await auditService.log({
        user_id: authorId,
        action: 'DOC_CREATED',
        resource_type: 'DocumentItem',
        resource_id: doc.document_item_id,
        details: { title: data.title },
      });

      await transaction.commit();
      return this.getById(doc.document_item_id, authorId);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, userId) {
    const { DocumentItem, ContentAudienceRule, sequelize } = require('../../database/models');

    if (Array.isArray(data.audience_targets)) {
      await assertAudienceWithinUserScope(userId, data.audience_targets);
    }

    const transaction = await sequelize.transaction();

    try {
      const doc = await DocumentItem.findByPk(id, { transaction });
      if (!doc) throw ApiError.notFound('Document not found');

      const fields = ['title', 'summary', 'category_id', 'priority'];
      fields.forEach((f) => {
        if (data[f] !== undefined) doc[f] = data[f];
      });
      if (data.title) doc.slug = generateSlug(data.title) + '-' + Date.now();

      doc.updated_by = userId;
      await doc.save({ transaction });

      if (Array.isArray(data.audience_targets)) {
        await ContentAudienceRule.destroy({
          where: { entity_type: 'DOCUMENT', entity_id: id },
          transaction,
        });

        if (data.audience_targets.length > 0) {
          await ContentAudienceRule.bulkCreate(data.audience_targets.map((target) => ({
            entity_type: 'DOCUMENT',
            entity_id: id,
            target_scope_type: target.scope_type || 'ORGANISATION',
            target_scope_id: target.scope_id,
          })), { transaction });
        }
      }

      await auditService.log({
        user_id: userId,
        action: 'DOC_UPDATED',
        resource_type: 'DocumentItem',
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
    const { DocumentItem } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.status === 'PUBLISHED') {
      throw ApiError.badRequest('Unpublish this document before moving it to the archive');
    }

    await doc.update({ deleted_at: new Date(), deleted_by: userId });

    await auditService.log({
      user_id: userId,
      action: 'DOC_ARCHIVED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    return { message: 'Document moved to archive' };
  },

  async bulkRestore(ids, userId) {
    const { DocumentItem } = require('../../database/models');
    const { Op } = require('sequelize');

    const docs = await DocumentItem.unscoped().findAll({
      where: { document_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });

    let restored = 0;
    for (const doc of docs) {
      await doc.update({ deleted_at: null });
      restored += 1;
    }

    if (restored > 0) {
      await auditService.log({
        user_id: userId,
        action: 'DOC_RESTORED',
        resource_type: 'DocumentItem',
        resource_id: docs[0]?.document_item_id || null,
        details: { count: restored },
      });
    }

    return { restored };
  },

  async bulkPurge(ids, userId) {
    const { DocumentItem, DocumentVersion, ContentAudienceRule } = require('../../database/models');
    const { Op } = require('sequelize');

    // Only operate on items already in the archive — published items must
    // be unpublished and archived first.
    const docs = await DocumentItem.unscoped().findAll({
      where: { document_item_id: { [Op.in]: ids }, deleted_at: { [Op.ne]: null } },
    });

    let purged = 0;
    for (const doc of docs) {
      const docId = doc.document_item_id;
      // Cascade: drop versions and audience rules first so FKs don't block.
      await DocumentVersion.destroy({ where: { document_item_id: docId } });
      await ContentAudienceRule.destroy({ where: { entity_type: 'DOCUMENT', entity_id: docId } });
      await doc.destroy({ force: true });
      purged += 1;
    }

    if (purged > 0) {
      await auditService.log({
        user_id: userId,
        action: 'DOC_PURGED',
        resource_type: 'DocumentItem',
        resource_id: null,
        details: { count: purged },
      });
    }

    return { purged };
  },

  async publish(id, userId) {
    const { DocumentItem, ContentAudienceRule } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.status === 'PUBLISHED') throw ApiError.badRequest('Document is already published');

    // published_at gets a fresh timestamp on every publish; unpublished_at is
    // cleared because the most recent unpublish is now stale.
    await doc.update({
      status: 'PUBLISHED',
      published_at: new Date(),
      published_by: userId,
      unpublished_at: null,
      unpublished_by: null,
    });

    await auditService.log({
      user_id: userId,
      action: 'DOC_PUBLISHED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    // Fan notifications out to the audience. Fire-and-forget — must not undo
    // the publish if downstream notification persistence/socket fails. The
    // `.catch()` here is a safety net beneath the internal try/catch.
    const audienceRules = await ContentAudienceRule.findAll({
      where: { entity_type: 'DOCUMENT', entity_id: id },
    });
    const notificationService = require('../notifications/notifications.service');
    const logger = require('../../config/logger');
    notificationService
      .notifyOnPublish({
        type: 'DOCUMENT',
        entity: { id, title: doc.title, summary: doc.summary },
        audienceRules,
        entityKey: 'documents',
      })
      .catch((err) => logger.error(`notifyOnPublish (DOCUMENT ${id}) rejected: ${err.message}`));

    return this.getById(id, userId);
  },

  // Re-send the publish notification for an already-published document.
  // Backfills missed fan-outs and lets admins nudge employees.
  async resendNotification(id) {
    const { DocumentItem, ContentAudienceRule } = require('../../database/models');
    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.status !== 'PUBLISHED') {
      throw ApiError.badRequest('Only published documents can be re-sent');
    }

    const audienceRules = await ContentAudienceRule.findAll({
      where: { entity_type: 'DOCUMENT', entity_id: id },
    });
    const notificationService = require('../notifications/notifications.service');
    return notificationService.notifyOnPublish({
      type: 'DOCUMENT',
      entity: { id, title: doc.title, summary: doc.summary },
      audienceRules,
      entityKey: 'documents',
    });
  },

  // "Publish Now" flow for documents — create and immediately flip status.
  async createAndPublish(data, userId) {
    const created = await this.create(data, userId);
    try {
      return await this.publish(created.document_item_id, userId);
    } catch (err) {
      try {
        await this.delete(created.document_item_id, userId);
      } catch (cleanupErr) {
        // Best-effort cleanup; not fatal.
      }
      throw err;
    }
  },

  async unpublish(id, userId) {
    const { DocumentItem } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.status !== 'PUBLISHED') throw ApiError.badRequest('Only published documents can be unpublished');

    // Keep published_at as the historical "last published on" stamp, and add
    // unpublished_at so the detail page can show "Unpublished on X".
    await doc.update({ status: 'DRAFT', unpublished_at: new Date(), unpublished_by: userId });

    await auditService.log({
      user_id: userId,
      action: 'DOC_UNPUBLISHED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    return this.getById(id, userId);
  },

  async listVersions(id) {
    const { DocumentVersion, UserAccount, MediaAsset } = require('../../database/models');

    return DocumentVersion.findAll({
      where: { document_item_id: id },
      include: [
        { model: UserAccount, as: 'uploader', attributes: ['user_id', 'first_name', 'last_name'] },
        { model: MediaAsset, as: 'media', required: false },
      ],
      order: [['version_no', 'DESC']],
    });
  },

  async createVersion(id, data, userId) {
    const { DocumentItem, DocumentVersion } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');

    const maxVersion = await DocumentVersion.max('version_no', {
      where: { document_item_id: id },
    });

    const versionFiles = buildVersionFileFields(data);
    const version = await DocumentVersion.create({
      document_item_id: id,
      version_no: (maxVersion || 0) + 1,
      files: versionFiles.files,
      file_url: versionFiles.file_url,
      file_name: versionFiles.file_name,
      file_size: versionFiles.file_size,
      mime_type: versionFiles.mime_type,
      changelog: data.changelog || null,
      uploaded_by: userId,
    });

    await auditService.log({
      user_id: userId,
      action: 'DOC_VERSION_CREATED',
      resource_type: 'DocumentVersion',
      resource_id: version.document_version_id,
      details: { document_id: id, version_no: version.version_no },
    });

    return version;
  },

  // Category operations — scoped to entity_type DOCUMENT so the dropdown
  // never shows News categories.
  //
  // When `userId` is supplied, the result is filtered to only the categories
  // the user has at least one visible published document under, with a live
  // `doc_count`. Without `userId` (admin flows), every DOCUMENT category is
  // returned with no count attached.
  async listCategories(userId = null) {
    const { Category, DocumentVersion } = require('../../database/models');
    const allCategories = await Category.findAll({
      where: { deleted_at: null, entity_type: 'DOCUMENT' },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });

    if (!userId) return allCategories;

    // Pull the latest version for each visible doc so we can count files
    // (one document can carry several attachments).
    const visibleDocs = await getVisibleDocumentsForUser(userId, {
      extraInclude: [{
        model: DocumentVersion,
        as: 'versions',
        attributes: ['document_version_id', 'version_no', 'files', 'file_url'],
        required: false,
        separate: true,
        order: [['version_no', 'DESC']],
        limit: 1,
      }],
    });

    const docCount = new Map();
    const fileCount = new Map();
    for (const doc of visibleDocs) {
      if (!doc.category_id) continue;
      docCount.set(doc.category_id, (docCount.get(doc.category_id) || 0) + 1);

      const v0 = doc.versions?.[0];
      let n = 0;
      if (v0) {
        if (Array.isArray(v0.files) && v0.files.length > 0) {
          n = v0.files.filter((f) => f && f.url).length;
        } else if (v0.file_url) {
          n = 1;
        }
      }
      fileCount.set(doc.category_id, (fileCount.get(doc.category_id) || 0) + n);
    }

    return allCategories
      .filter((c) => docCount.has(c.category_id))
      .map((c) => {
        const plain = c.toJSON();
        plain.doc_count = docCount.get(c.category_id) || 0;
        plain.file_count = fileCount.get(c.category_id) || 0;
        return plain;
      });
  },

  async recordView(documentId, userId) {
    const { DocumentView } = require('../../database/models');
    // getById enforces audience visibility — if the user shouldn't see it,
    // it throws notFound and we never write a view row.
    await this.getById(documentId, userId);

    const [row, created] = await DocumentView.findOrCreate({
      where: { user_id: userId, document_item_id: documentId },
      defaults: { viewed_at: new Date() },
    });
    if (!created) {
      row.viewed_at = new Date();
      await row.save();
    }
    return { ok: true };
  },

  async listRecentlyViewed(userId, limit = 10) {
    const { DocumentView, DocumentItem, DocumentVersion, Category, ContentAudienceRule } = require('../../database/models');

    const managing = await canManageDocuments(userId);
    // Pull a generous slab so audience filtering still leaves us `limit`.
    const views = await DocumentView.findAll({
      where: { user_id: userId },
      order: [['viewed_at', 'DESC']],
      limit: Math.max(limit * 3, 30),
      include: [{
        model: DocumentItem,
        as: 'document',
        required: true,
        where: { deleted_at: null, status: 'PUBLISHED' },
        include: [
          { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
          { model: ContentAudienceRule, as: 'audienceRules', where: { entity_type: 'DOCUMENT' }, required: false },
          {
            model: DocumentVersion,
            as: 'versions',
            attributes: ['document_version_id', 'version_no', 'file_name', 'file_size', 'mime_type', 'file_url', 'files'],
            required: false,
            separate: true,
            order: [['version_no', 'DESC']],
            limit: 1,
          },
        ],
      }],
    });

    // Managers see every doc they've viewed. Regular users get the audience
    // filter so a doc that was retargeted away from them stops surfacing
    // here — view permission already had to be granted at the time of the
    // view, but their scope may have changed since.
    let visible = views.filter((v) => v.document);
    if (!managing) {
      const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
      visible = visible.filter((v) => documentMatchesAudience(v.document, userAudienceScopeKeys));
    }

    return visible.slice(0, limit).map((v) => ({
      view_id: v.view_id,
      viewed_at: v.viewed_at,
      document: v.document,
    }));
  },

  async getFeatured(userId) {
    const { DocumentVersion } = require('../../database/models');
    const visible = await getVisibleDocumentsForUser(userId, {
      extraInclude: [{
        model: DocumentVersion,
        as: 'versions',
        attributes: ['document_version_id', 'version_no', 'file_name', 'file_size', 'mime_type', 'file_url', 'files'],
        required: false,
        separate: true,
        order: [['version_no', 'DESC']],
        limit: 1,
      }],
    });
    if (visible.length === 0) return null;
    const priorityRank = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
    visible.sort((a, b) => {
      const r = (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9);
      if (r !== 0) return r;
      const aDate = a.published_at || a.created_at;
      const bDate = b.published_at || b.created_at;
      return new Date(bDate) - new Date(aDate);
    });
    const top = visible[0];
    if (!top || (top.priority !== 'URGENT' && top.priority !== 'HIGH')) return null;
    return top;
  },

  async getStorageSummary(userId) {
    const { sequelize } = require('../../database/models');
    const { QueryTypes } = require('sequelize');
    const visibleDocs = await getVisibleDocumentsForUser(userId);
    const ids = visibleDocs.map((d) => d.document_item_id);

    let usedBytes = 0;
    if (ids.length > 0) {
      // Sum the latest version's file_size per document so we don't
      // double-count revision history.
      const rows = await sequelize.query(
        `SELECT COALESCE(SUM(latest.file_size), 0) AS used_bytes
         FROM (
           SELECT DISTINCT ON (document_item_id) document_item_id, file_size
           FROM document_version
           WHERE document_item_id IN (:ids)
           ORDER BY document_item_id, version_no DESC
         ) latest`,
        { replacements: { ids }, type: QueryTypes.SELECT }
      );
      usedBytes = Number(rows?.[0]?.used_bytes || 0);
    }

    const totalBytes = Number(process.env.DOCUMENTS_STORAGE_QUOTA_BYTES) || 50 * 1024 * 1024 * 1024; // 50 GB
    return {
      used_bytes: usedBytes,
      total_bytes: totalBytes,
      document_count: visibleDocs.length,
    };
  },

  // Single-category lookup for the employee Category Detail page.
  // Returns the category if the user has at least one visible document in it,
  // with `doc_count` attached. Otherwise throws notFound — no signal that
  // the category exists at all.
  async getCategoryById(categoryId, userId) {
    const { Category, DocumentVersion } = require('../../database/models');
    const cat = await Category.findOne({
      where: { category_id: categoryId, entity_type: 'DOCUMENT', deleted_at: null },
    });
    if (!cat) throw ApiError.notFound('Category not found');

    if (userId) {
      const visibleDocs = await getVisibleDocumentsForUser(userId, {
        extraInclude: [{
          model: DocumentVersion,
          as: 'versions',
          attributes: ['document_version_id', 'version_no', 'files', 'file_url'],
          required: false,
          separate: true,
          order: [['version_no', 'DESC']],
          limit: 1,
        }],
      });
      const inCategory = visibleDocs.filter((d) => d.category_id === Number(categoryId));
      if (inCategory.length === 0) throw ApiError.notFound('Category not found');

      let fileCount = 0;
      for (const d of inCategory) {
        const v0 = d.versions?.[0];
        if (v0 && Array.isArray(v0.files) && v0.files.length > 0) {
          fileCount += v0.files.filter((f) => f && f.url).length;
        } else if (v0?.file_url) {
          fileCount += 1;
        }
      }

      const plain = cat.toJSON();
      plain.doc_count = inCategory.length;
      plain.file_count = fileCount;
      return plain;
    }
    return cat;
  },

  async createCategory(data) {
    const { Category } = require('../../database/models');
    const slug = generateSlug(data.name);
    return Category.create({
      tenant_id: DEFAULT_TENANT_ID,
      entity_type: 'DOCUMENT',
      name: data.name,
      slug,
      description: data.description || null,
      sort_order: data.sort_order || 0,
      parent_category_id: data.parent_category_id || null,
    });
  },

  async updateCategory(id, data) {
    const { Category } = require('../../database/models');
    const cat = await Category.findOne({
      where: { category_id: id, entity_type: 'DOCUMENT' },
    });
    if (!cat) throw ApiError.notFound('Category not found');

    const fields = ['name', 'description', 'sort_order'];
    fields.forEach((f) => {
      if (data[f] !== undefined) cat[f] = data[f];
    });
    if (data.name) cat.slug = generateSlug(data.name);

    await cat.save();
    return cat;
  },

  async deleteCategory(id) {
    const { Category } = require('../../database/models');
    const cat = await Category.findOne({
      where: { category_id: id, entity_type: 'DOCUMENT' },
    });
    if (!cat) throw ApiError.notFound('Category not found');
    await cat.update({ deleted_at: new Date() });
    return { message: 'Category deleted successfully' };
  },
};

module.exports = documentsService;
