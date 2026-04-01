const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const uploadSchema = {
  body: Joi.object({
    org_unit_id: idPattern.optional(),
    alt_text: Joi.string().trim().max(512).optional().allow('', null),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

module.exports = {
  uploadSchema,
  idParam,
};
