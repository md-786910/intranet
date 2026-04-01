const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listNewsSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('DRAFT', 'PUBLISHED', 'ARCHIVED').optional(),
    org_unit_id: idPattern.required(),
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
    owning_org_unit_id: idPattern.required(),
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
    org_unit_id: idPattern.required(),
  }),
};

const setAudienceSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    org_unit_ids: Joi.array().items(idPattern).min(1).required(),
    org_unit_id: idPattern.required(),
  }),
};

module.exports = {
  listNewsSchema,
  idParam,
  createNewsSchema,
  updateNewsSchema,
  setAudienceSchema,
};
