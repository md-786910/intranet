const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

// Accept absolute http(s) URLs or in-app relative paths starting with "/".
const urlPattern = Joi.string()
  .trim()
  .min(1)
  .max(500)
  .pattern(/^(https?:\/\/|\/).+/i)
  .messages({
    'string.pattern.base':
      'URL must start with http://, https://, or "/" for in-app routes.',
  });

const idParam = {
  params: Joi.object({ id: idPattern.required() }),
};

const createSchema = {
  body: Joi.object({
    label: Joi.string().trim().min(1).max(100).required(),
    url: urlPattern.required(),
  }),
};

const updateSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    label: Joi.string().trim().min(1).max(100).optional(),
    url: urlPattern.optional(),
  }).min(1),
};

module.exports = {
  idParam,
  createSchema,
  updateSchema,
};
