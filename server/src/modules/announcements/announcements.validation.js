const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid(
  'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
  'GROUP', 'COMPANY', 'ADMIN_UNIT',
);
const priorityPattern = Joi.string().valid('LOW', 'NORMAL', 'HIGH', 'URGENT');

const scopeTarget = Joi.object({
  scope_type: scopeTypePattern.required(),
  scope_id: idPattern.required(),
});

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED').optional(),
    priority: priorityPattern.optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    trash: Joi.boolean().optional(),
    viewer: Joi.alternatives().try(Joi.boolean(), Joi.number().valid(0, 1), Joi.string().valid('0', '1')).optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const bulkIdsSchema = {
  body: Joi.object({
    ids: Joi.array().items(idPattern).min(1).max(100).required(),
  }),
};

const createSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    body: Joi.string().required(),
    priority: priorityPattern.optional(),
    show_in_marquee: Joi.boolean().optional(),
    marquee_starts_at: Joi.date().iso().optional().allow(null),
    marquee_ends_at: Joi.date().iso().optional().allow(null),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    push_notify: Joi.boolean().optional(),
  }),
};

const publishSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    push_notify: Joi.boolean().optional(),
  }),
};

const scheduleSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    scheduled_at: Joi.date().iso().greater('now').required(),
  }),
};

const createAndScheduleSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    body: Joi.string().required(),
    priority: priorityPattern.optional(),
    show_in_marquee: Joi.boolean().optional(),
    marquee_starts_at: Joi.date().iso().optional().allow(null),
    marquee_ends_at: Joi.date().iso().optional().allow(null),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    push_notify: Joi.boolean().optional(),
    scheduled_at: Joi.date().iso().greater('now').required(),
  }),
};

const updateSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).optional(),
    body: Joi.string().optional(),
    priority: priorityPattern.optional(),
    show_in_marquee: Joi.boolean().optional(),
    marquee_starts_at: Joi.date().iso().optional().allow(null),
    marquee_ends_at: Joi.date().iso().optional().allow(null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
    push_notify: Joi.boolean().optional(),
  }),
};

const setAudienceSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    targets: Joi.array().items(scopeTarget).min(1).required(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

module.exports = {
  listSchema,
  idParam,
  bulkIdsSchema,
  createSchema,
  publishSchema,
  scheduleSchema,
  createAndScheduleSchema,
  updateSchema,
  setAudienceSchema,
};
