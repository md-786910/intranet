const ApiError = require('../../utils/ApiError');
const auditService = require('../../services/audit.service');
const { DEFAULT_TENANT_ID } = require('../../utils/constants');
const { parsePagination, buildPagination } = require('../../utils/pagination');

function generateSlug(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

const documentsService = {
  async list(query) {
    const { DocumentItem, UserAccount, Category } = require('../../database/models');
    const { Op } = require('sequelize');
    const { page, limit, offset } = parsePagination(query);

    const where = { deleted_at: null };
    if (query.status) where.status = query.status;
    if (query.category_id) where.category_id = query.category_id;
    if (query.search) {
      where[Op.or] = [
        { title: { [Op.iLike]: `%${query.search}%` } },
        { summary: { [Op.iLike]: `%${query.search}%` } },
      ];
    }

    const { rows, count } = await DocumentItem.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: UserAccount, as: 'author', attributes: ['user_id', 'first_name', 'last_name', 'email'] },
        { model: Category, as: 'category', attributes: ['category_id', 'name', 'slug'] },
      ],
      order: [['created_at', 'DESC']],
    });

    return {
      documents: rows,
      pagination: buildPagination(page, limit, count),
    };
  },

  async getById(id) {
    const { DocumentItem, UserAccount, Category, DocumentVersion, ContentAudienceRule, OrgUnit } = require('../../database/models');

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
          include: [{ model: OrgUnit, as: 'targetOrgUnit', attributes: ['org_unit_id', 'name', 'node_type'] }],
        },
      ],
    });

    if (!doc) throw ApiError.notFound('Document not found');
    return doc;
  },

  async create(data, authorId) {
    const { DocumentItem, DocumentVersion, sequelize } = require('../../database/models');
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
        owning_org_unit_id: data.owning_org_unit_id,
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

      await auditService.log({
        user_id: authorId,
        action: 'DOC_CREATED',
        resource_type: 'DocumentItem',
        resource_id: doc.document_item_id,
        details: { title: data.title },
      });

      await transaction.commit();
      return this.getById(doc.document_item_id);
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  },

  async update(id, data, userId) {
    const { DocumentItem } = require('../../database/models');

    const doc = await DocumentItem.findByPk(id);
    if (!doc) throw ApiError.notFound('Document not found');

    const fields = ['title', 'summary', 'category_id'];
    fields.forEach((f) => {
      if (data[f] !== undefined) doc[f] = data[f];
    });
    if (data.title) doc.slug = generateSlug(data.title) + '-' + Date.now();

    await doc.save();

    await auditService.log({
      user_id: userId,
      action: 'DOC_UPDATED',
      resource_type: 'DocumentItem',
      resource_id: id,
    });

    return this.getById(id);
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

    return this.getById(id);
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
