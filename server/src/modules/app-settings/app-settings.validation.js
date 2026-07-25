'use strict';

const Joi = require('joi');

const nameField = Joi.string().trim().min(1).max(100).required().messages({
  'string.empty': 'Value is required',
  'string.max': 'Must be at most 100 characters',
});

const updateSchema = {
  body: Joi.object({
    application_name: nameField,
    meta_title: nameField,
  }),
};

module.exports = {
  updateSchema,
};
