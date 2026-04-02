const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT');

const scopeTarget = Joi.object({
  scope_type: scopeTypePattern.required(),
  scope_id: idPattern.required(),
});

const listNewsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createNewsSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    summary: Joi.string().trim().max(500).optional().allow('', null),
    body: Joi.string().required(),
    cover_image_url: Joi.string().uri().optional().allow('', null),
    cover_image_id: idPattern.optional().allow(null),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
  }),
};

const updateNewsSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).optional(),
    summary: Joi.string().trim().max(500).optional().allow('', null),
    body: Joi.string().optional(),
    cover_image_url: Joi.string().uri().optional().allow('', null),
    cover_image_id: idPattern.optional().allow(null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).optional(),
  }),
};

const setAudienceSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    targets: Joi.array().items(scopeTarget).min(1).required(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

module.exports = {
  listNewsSchema,
  idParam,
  createNewsSchema,
  updateNewsSchema,
  setAudienceSchema,
};
