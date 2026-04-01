const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listRolesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
  }),
};

const getModulesSchema = {
  query: Joi.object({
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createRoleSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).uppercase().pattern(/^[A-Z][A-Z0-9_]*$/).required()
      .messages({ 'string.pattern.base': 'Code must be uppercase alphanumeric with underscores' }),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
    permissions: Joi.array().items(
      Joi.object({
        module_action_id: idPattern.required(),
        effect: Joi.string().valid('ALLOW', 'DENY').default('ALLOW'),
      })
    ).min(1).required(),
  }),
};

const updateRoleSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    description: Joi.string().trim().max(1000).optional().allow('', null),
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
    permissions: Joi.array().items(
      Joi.object({
        module_action_id: idPattern.required(),
        effect: Joi.string().valid('ALLOW', 'DENY').default('ALLOW'),
      })
    ).min(1).optional(),
  }),
};

const cloneRoleSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).uppercase().pattern(/^[A-Z][A-Z0-9_]*$/).required(),
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
  }),
};

module.exports = {
  listRolesSchema,
  getModulesSchema,
  idParam,
  createRoleSchema,
  updateRoleSchema,
  cloneRoleSchema,
};
