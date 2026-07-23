'use strict';

const Joi = require('joi');

const passwordPattern = Joi.string()
  .min(6)
  .max(128)
  .messages({
    'string.min': 'Password must be at least 6 characters',
  });

const syncUsersSchema = {
  body: Joi.object({
    dry_run: Joi.boolean().default(false),
    only_enabled: Joi.boolean().default(true),
    // Optional: only needed to create Entra users not yet in BrightNow.
    // Updates of existing users (by email / azure_object_id) never need a password.
    password: passwordPattern.optional().allow('', null),
  }),
};

module.exports = {
  syncUsersSchema,
};
