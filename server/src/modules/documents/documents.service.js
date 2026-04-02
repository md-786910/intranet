const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');
const permissionService = require('../../services/permission.service');
const scopeService = require('../../services/scope.service');

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
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

async function getUserAudienceScopeKeys(userId) {
  const { UserRoleAssignment, UserPermission, DepartmentMembership } = require('../../database/models');
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
    UserRoleAssignment.findAll({ where: { user_id: userId }, attributes: ['scope_type', 'scope_id'] }),
    UserPermission.findAll({ where: { user_id: userId, effect: 'ALLOW' }, attributes: ['scope_type', 'scope_id'] }),
    DepartmentMembership.findAll({ where: { user_id: userId }, attributes: ['department_id'] }),
  ]);

  for (const assignment of roleAssignments) await addAncestors(assignment.scope_type, assignment.scope_id);
  for (const permission of directPermissions) await addAncestors(permission.scope_type, permission.scope_id);
  for (const membership of departmentMemberships) await addAncestors('DEPARTMENT', membership.department_id);

  return scopeKeys;
}

function documentMatchesAudience(doc, userAudienceScopeKeys) {
  const audienceRules = doc.audienceRules || [];
  if (audienceRules.length === 0) return true;

  return audienceRules.some((rule) =>
    userAudienceScopeKeys.has(`${rule.target_scope_type}:${rule.target_scope_id}`));
}

const documentsService = {
  async list(query, userId) {
    const { DocumentItem, UserAccount, Category, ContentAudienceRule } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);
    const managing = await canManageDocuments(userId);

    const where = { deleted_at: null };
    if (managing) {
      if (query.status) where.status = query.status;
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

    const include = [
      { model: UserAccount, as: 'author', attributes: ['user_id', 'first_name', 'last_name', 'email'] },
      { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'], required: false },
    ];

    if (!managing) {
      include.push({
        model: ContentAudienceRule,
        as: 'audienceRules',
        where: { entity_type: 'DOCUMENT' },
        required: false,
      });
    }

    if (managing) {
      const { rows, count } = await DocumentItem.findAndCountAll({
        where,
        limit,
        offset,
        include,
        order: [['created_at', 'DESC']],
      });

      return {
        documents: rows,
        pagination: buildPagination(page, limit, count),
      };
    }

    const userAudienceScopeKeys = await getUserAudienceScopeKeys(userId);
    const rows = await DocumentItem.findAll({
      where,
      include,
      order: [['created_at', 'DESC']],
    });

    const visibleDocuments = rows.filter((doc) => documentMatchesAudience(doc, userAudienceScopeKeys));
    const paginatedDocuments = visibleDocuments.slice(offset, offset + limit);

    return {
      documents: paginatedDocuments,
      pagination: buildPagination(page, limit, visibleDocuments.length),
    };
  },

  async getById(id, userId = null) {
    const { DocumentItem, UserAccount, Category, DocumentVersion, ContentAudienceRule } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id, {
      include: [
        { model: UserAccount, as: 'author', attributes: ['user_id', 'first_name', 'last_name', 'email'] },
        { model: Category, as: 'category', required: false },
        {
          model: DocumentVersion,
          as: 'versions',
          order: [['version_no', 'DESC']],
          include: [{ model: UserAccount, as: 'uploader', attributes: ['user_id', 'first_name', 'last_name'] }],
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
    const transaction = await sequelize.transaction();

    try {
      const slug = generateSlug(data.title) + '-' + Date.now();

      const doc = await DocumentItem.create({
        tenant_id: DEFAULT_TENANT_ID,
        title: data.title,
        slug,
        summary: data.summary || null,
        category_id: data.category_id || null,
        status: 'DRAFT',
        author_id: authorId,
        owning_scope_type: data.owning_scope_type || 'ORGANISATION',
        owning_scope_id: data.owning_scope_id,
      }, { transaction });

      // Create initial version
      await DocumentVersion.create({
        document_item_id: doc.document_item_id,
        version_no: 1,
        file_url: data.file_url,
        file_name: data.file_name,
        file_size: data.file_size || null,
        mime_type: data.mime_type || null,
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
    const transaction = await sequelize.transaction();

    try {
      const doc = await DocumentItem.findByPk(id, { transaction });
      if (!doc) throw ApiError.notFound('Document not found');

      const fields = ['title', 'summary', 'category_id'];
      fields.forEach((f) => {
        if (data[f] !== undefined) doc[f] = data[f];
      });
      if (data.title) doc.slug = generateSlug(data.title) + '-' + Date.now();

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

    await doc.update({ deleted_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'DOC_DELETED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    return { message: 'Document deleted successfully' };
  },

  async publish(id, userId) {
    const { DocumentItem } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');
    if (doc.status === 'PUBLISHED') throw ApiError.badRequest('Document is already published');

    await doc.update({ status: 'PUBLISHED', published_at: new Date() });

    await auditService.log({
      user_id: userId,
      action: 'DOC_PUBLISHED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    return this.getById(id, userId);
  },

  async listVersions(id) {
    const { DocumentVersion, UserAccount } = require('../../database/models');

    return DocumentVersion.findAll({
      where: { document_item_id: id },
      include: [{ model: UserAccount, as: 'uploader', attributes: ['user_id', 'first_name', 'last_name'] }],
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

    const version = await DocumentVersion.create({
      document_item_id: id,
      version_no: (maxVersion || 0) + 1,
      file_url: data.file_url,
      file_name: data.file_name,
      file_size: data.file_size || null,
      mime_type: data.mime_type || null,
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

  // Category operations
  async listCategories() {
    const { Category } = require('../../database/models');
    return Category.findAll({
      where: { deleted_at: null },
      order: [['sort_order', 'ASC'], ['name', 'ASC']],
    });
  },

  async createCategory(data) {
    const { Category } = require('../../database/models');
    const slug = generateSlug(data.name);
    return Category.create({
      tenant_id: DEFAULT_TENANT_ID,
      name: data.name,
      slug,
      description: data.description || null,
      sort_order: data.sort_order || 0,
      parent_category_id: data.parent_category_id || null,
    });
  },

  async updateCategory(id, data) {
    const { Category } = require('../../database/models');
    const cat = await Category.findByPk(id);
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
    const cat = await Category.findByPk(id);
    if (!cat) throw ApiError.notFound('Category not found');
    await cat.update({ deleted_at: new Date() });
    return { message: 'Category deleted successfully' };
  },
};

module.exports = documentsService;
