const Joi = require('joi');

const idParam = {
  params: Joi.object({ id: Joi.number().integer().positive().required() }),
};

const createSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }),
};

const updateSchema = {
  params: Joi.object({ id: Joi.number().integer().positive().required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(100).required(),
  }),
};

module.exports = { idParam, createSchema, updateSchema };
