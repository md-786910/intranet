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

module.exports = {
  uploadSchema,
  idParam,
};
