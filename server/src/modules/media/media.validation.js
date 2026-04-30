const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const uploadSchema = {
  body: Joi.object({
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
    alt_text: Joi.string().trim().max(512).optional().allow('', null),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const listSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    mime_prefix: Joi.string().trim().max(64).optional().allow(''),
    trash: Joi.boolean().optional(),
  }),
};

const bulkIdsSchema = {
  body: Joi.object({
    ids: Joi.array().items(idPattern).min(1).max(100).required(),
  }),
};

module.exports = {
  uploadSchema,
  idParam,
  listSchema,
  bulkDeleteSchema: bulkIdsSchema,
  bulkRestoreSchema: bulkIdsSchema,
};
