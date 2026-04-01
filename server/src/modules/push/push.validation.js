const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listPushSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED').optional(),
    org_unit_id: idPattern.required(),
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
    owning_org_unit_id: idPattern.required(),
    audience_org_unit_ids: Joi.array().items(idPattern).min(1).required(),
    scheduled_at: Joi.date().iso().optional().allow(null),
  }),
};

module.exports = {
  listPushSchema,
  idParam,
  createPushSchema,
};
