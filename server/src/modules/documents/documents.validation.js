const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT');

const scopeTarget = Joi.object({
  scope_type: scopeTypePattern.required(),
  scope_id: idPattern.required(),
});

const listDocsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    category_id: idPattern.optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const categoryIdParam = {
  params: Joi.object({
    categoryId: idPattern.required(),
  }),
};

const createDocSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    summary: Joi.string().trim().max(2000).optional().allow('', null),
    category_id: idPattern.optional().allow(null),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    file_url: Joi.string().required(),
    file_name: Joi.string().required(),
    file_size: Joi.number().integer().optional(),
    mime_type: Joi.string().optional(),
    changelog: Joi.string().trim().max(500).optional().allow('', null),
  }),
};

const updateDocSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).optional(),
    summary: Joi.string().trim().max(2000).optional().allow('', null),
    category_id: idPattern.optional().allow(null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
  }),
};

const createVersionSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    file_url: Joi.string().required(),
    file_name: Joi.string().required(),
    file_size: Joi.number().integer().optional(),
    mime_type: Joi.string().optional(),
    changelog: Joi.string().trim().max(500).optional().allow('', null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).default(0),
    parent_category_id: idPattern.optional().allow(null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const updateCategorySchema = {
  params: Joi.object({
    categoryId: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

module.exports = {
  listDocsSchema,
  idParam,
  categoryIdParam,
  createDocSchema,
  updateDocSchema,
  createVersionSchema,
  createCategorySchema,
  updateCategorySchema,
};
