const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const idParam = {
  params: Joi.object({ id: idPattern.required() }),
};

const createSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
    rank: Joi.number().integer().min(1).optional(),
    description: Joi.string().trim().max(255).optional().allow('', null),
  }),
};

const updateSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).optional(),
    rank: Joi.number().integer().min(1).optional(),
    description: Joi.string().trim().max(255).optional().allow('', null),
  }).min(1),
};

const reorderSchema = {
  body: Joi.object({
    ordered_ids: Joi.array().items(idPattern).min(1).required(),
  }),
};

module.exports = {
  idParam,
  createSchema,
  updateSchema,
  reorderSchema,
};
