const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid(
  'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
  'GROUP', 'COMPANY', 'ADMIN_UNIT',
);

const scopeTarget = Joi.object({
  scope_type: scopeTypePattern.required(),
  scope_id: idPattern.required(),
});

const fileEntry = Joi.object({
  url: Joi.string().required(),
  name: Joi.string().required(),
  size: Joi.number().integer().min(0).optional().allow(null),
  mime: Joi.string().optional().allow('', null),
  source: Joi.string().valid('upload', 'library', 'url').optional(),
});

const priorityPattern = Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT');

const listDocsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED').optional(),
    category_id: idPattern.optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    trash: Joi.boolean().optional(),
    // Filter chips from the employee-client filter popover.
    // Both accept comma-separated strings or repeated query params.
    priority: Joi.alternatives(
      priorityPattern,
      Joi.array().items(priorityPattern),
      Joi.string().pattern(/^[A-Z,]+$/).max(40),
    ).optional(),
    mime_prefix: Joi.alternatives(
      Joi.string().max(80),
      Joi.array().items(Joi.string().max(80)),
    ).optional(),
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
    summary: Joi.string().trim().max(50000).optional().allow('', null),
    category_id: idPattern.optional().allow(null),
    priority: priorityPattern.optional(),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    // Preferred new shape — JSONB array of files. Old single-file fields
    // remain optional so legacy clients still work, but at least one of the
    // two paths must be present.
    files: Joi.array().items(fileEntry).min(1).optional(),
    file_url: Joi.string().optional().allow('', null),
    file_name: Joi.string().optional().allow('', null),
    file_size: Joi.number().integer().optional(),
    mime_type: Joi.string().optional().allow('', null),
    changelog: Joi.string().trim().max(500).optional().allow('', null),
    push_notify: Joi.boolean().optional(),
  }).or('files', 'file_url'),
};

const publishSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    push_notify: Joi.boolean().optional(),
  }),
};

const scheduleSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    scheduled_at: Joi.date().iso().greater('now').required(),
  }),
};

const createAndScheduleSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    summary: Joi.string().trim().max(50000).optional().allow('', null),
    category_id: idPattern.optional().allow(null),
    priority: priorityPattern.optional(),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    files: Joi.array().items(fileEntry).min(1).optional(),
    file_url: Joi.string().optional().allow('', null),
    file_name: Joi.string().optional().allow('', null),
    file_size: Joi.number().integer().optional(),
    mime_type: Joi.string().optional().allow('', null),
    changelog: Joi.string().trim().max(500).optional().allow('', null),
    push_notify: Joi.boolean().optional(),
    scheduled_at: Joi.date().iso().greater('now').required(),
  }).or('files', 'file_url'),
};

const updateDocSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).optional(),
    summary: Joi.string().trim().max(50000).optional().allow('', null),
    category_id: idPattern.optional().allow(null),
    priority: priorityPattern.optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    push_notify: Joi.boolean().optional(),
  }),
};

const createVersionSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    files: Joi.array().items(fileEntry).min(1).optional(),
    file_url: Joi.string().optional().allow('', null),
    file_name: Joi.string().optional().allow('', null),
    file_size: Joi.number().integer().optional(),
    mime_type: Joi.string().optional().allow('', null),
    changelog: Joi.string().trim().max(500).optional().allow('', null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }).or('files', 'file_url'),
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

const bulkIdsSchema = {
  body: Joi.object({
    ids: Joi.array().items(idPattern).min(1).max(100).required(),
  }),
};

module.exports = {
  listDocsSchema,
  idParam,
  categoryIdParam,
  createDocSchema,
  publishSchema,
  scheduleSchema,
  createAndScheduleSchema,
  updateDocSchema,
  createVersionSchema,
  createCategorySchema,
  updateCategorySchema,
  bulkIdsSchema,
};
