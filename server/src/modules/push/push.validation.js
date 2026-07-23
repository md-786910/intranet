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

const listPushSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED').optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createPushSchema = {
  body: Joi.object({
    title: Joi.string().trim().min(1).max(255).required(),
    body: Joi.string().trim().min(1).max(1000).required(),
    owning_scope_type: scopeTypePattern.optional(),
    owning_scope_id: idPattern.optional(),
    audience_targets: Joi.array().items(scopeTarget).min(1).required(),
    scheduled_at: Joi.date().iso().optional().allow(null),
  }),
};

module.exports = {
  listPushSchema,
  idParam,
  createPushSchema,
};
