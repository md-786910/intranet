const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const entityTypePattern = Joi.string().valid('NEWS', 'DOCUMENT');

const listSchema = {
  query: Joi.object({
    entity_type: entityTypePattern.required(),
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(200).default(50),
    search: Joi.string().trim().max(255).optional().allow(''),
    trash: Joi.boolean().optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createSchema = {
  body: Joi.object({
    entity_type: entityTypePattern.required(),
    name: Joi.string().trim().min(1).max(255).required(),
    slug: Joi.string().trim().max(300).optional().allow('', null),
    description: Joi.string().trim().max(2000).optional().allow('', null),
    parent_category_id: idPattern.optional().allow(null),
    sort_order: Joi.number().integer().min(0).max(10000).optional(),
  }),
};

const updateSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    slug: Joi.string().trim().max(300).optional().allow('', null),
    description: Joi.string().trim().max(2000).optional().allow('', null),
    parent_category_id: idPattern.optional().allow(null),
    sort_order: Joi.number().integer().min(0).max(10000).optional(),
  }).min(1),
};

const bulkRestoreSchema = {
  body: Joi.object({
    ids: Joi.array().items(idPattern).min(1).max(100).required(),
  }),
};

module.exports = {
  listSchema,
  idParam,
  createSchema,
  updateSchema,
  bulkRestoreSchema,
};
