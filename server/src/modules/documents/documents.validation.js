const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listDocsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    category_id: idPattern.optional(),
    org_unit_id: idPattern.required(),
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
    owning_org_unit_id: idPattern.required(),
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
    org_unit_id: idPattern.required(),
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
    org_unit_id: idPattern.required(),
  }),
};

const createCategorySchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).default(0),
    parent_category_id: idPattern.optional().allow(null),
    org_unit_id: idPattern.required(),
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
    org_unit_id: idPattern.required(),
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
