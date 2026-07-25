'use strict';

const Joi = require('joi');

// Match auth change-password complexity (see auth.validation.js passwordPattern)
const passwordPattern = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?])/)
  .messages({
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base':
      'Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character',
  });

const syncUsersSchema = {
  body: Joi.object({
    dry_run: Joi.boolean().default(false),
    only_enabled: Joi.boolean().default(true),
    // Optional: blank → server generates a strong per-user temp password.
    // Updates of existing users never need a password.
    password: passwordPattern.optional().allow('', null),
  }),
};

const syncLocalUserSchema = {
  params: Joi.object({
    userId: Joi.number().integer().positive().required(),
  }),
};

module.exports = {
  syncUsersSchema,
  syncLocalUserSchema,
};
