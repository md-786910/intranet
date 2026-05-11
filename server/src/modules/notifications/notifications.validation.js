const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const idParam = {
  params: Joi.object({ id: idPattern.required() }),
};

const listQuery = {
  query: Joi.object({
    limit: Joi.number().integer().min(1).max(50).default(20),
    before: Joi.date().iso().optional(),
  }),
};

module.exports = {
  idParam,
  listQuery,
};
