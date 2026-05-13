const Joi = require('joi');

const callbackSchema = {
  body: Joi.object({
    code: Joi.string().required().messages({
      'any.required': 'Authorization code is required',
    }),
    state: Joi.string().required().messages({
      'any.required': 'State token is required',
    }),
  }),
};

module.exports = { callbackSchema };
