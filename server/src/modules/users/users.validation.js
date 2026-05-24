const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT');

const passwordPattern = Joi.string()
  .min(6)
  .max(128)
  .messages({
    'string.min': 'Password must be at least 6 characters',
  });

const listUsersSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED', 'INVITED').optional(),
    department_id: idPattern.optional(),
    office_location_id: idPattern.optional(),
    vertical_id: idPattern.optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createUserSchema = {
  body: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    password: passwordPattern.optional().allow('', null),
    first_name: Joi.string().trim().min(1).max(100).required(),
    last_name: Joi.string().trim().min(1).max(100).required(),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    profile: Joi.object({
      job_title: Joi.string().trim().max(255).optional().allow('', null),
      bio: Joi.string().trim().max(2000).optional().allow('', null),
      employee_id: Joi.string().trim().max(50).optional().allow('', null),
      date_of_birth: Joi.date().iso().optional().allow(null),
      date_of_joining: Joi.date().iso().optional().allow(null),
    }).optional(),
    initial_role: Joi.object({
      role_id: idPattern.required(),
      scope_type: scopeTypePattern.required(),
      scope_id: idPattern.required(),
    }).optional(),
    initial_roles: Joi.array().items(
      Joi.object({
        role_id: idPattern.required(),
        scope_type: scopeTypePattern.required(),
        scope_id: idPattern.required(),
      })
    ).optional(),
    initial_permissions: Joi.array().items(
      Joi.object({
        module_action_id: idPattern.required(),
        scope_type: scopeTypePattern.required(),
        scope_id: idPattern.required(),
      })
    ).optional(),
    // Employee-specific fields
    role_category_id: idPattern.optional(),
    reports_to_user_id: idPattern.optional().allow(null),
    department_ids: Joi.array().items(idPattern).min(1).optional(),
    primary_department_id: idPattern.optional().allow(null),
    chat_blocked_user_ids: Joi.array().items(idPattern).optional(),
  }),
};

const updateUserSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    first_name: Joi.string().trim().min(1).max(100).optional(),
    last_name: Joi.string().trim().min(1).max(100).optional(),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED', 'INVITED').optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
    profile: Joi.object({
      job_title: Joi.string().trim().max(255).optional().allow('', null),
      bio: Joi.string().trim().max(2000).optional().allow('', null),
      employee_id: Joi.string().trim().max(50).optional().allow('', null),
      date_of_birth: Joi.date().iso().optional().allow(null),
      date_of_joining: Joi.date().iso().optional().allow(null),
    }).optional(),
    // Employee-specific fields
    role_category_id: idPattern.optional().allow(null),
    reports_to_user_id: idPattern.optional().allow(null),
    department_ids: Joi.array().items(idPattern).min(1).optional(),
    primary_department_id: idPattern.optional().allow(null),
    chat_blocked_user_ids: Joi.array().items(idPattern).optional(),
  }),
};

const assignRoleSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    role_id: idPattern.required(),
    scope_type: scopeTypePattern.required(),
    scope_id: idPattern.required(),
    starts_at: Joi.date().iso().optional().allow(null),
    ends_at: Joi.date().iso().optional().allow(null),
  }),
};

const assignDepartmentSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    department_id: idPattern.required(),
    is_primary: Joi.boolean().default(false),
  }),
};

const assignPermissionSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    module_action_id: idPattern.required(),
    scope_type: scopeTypePattern.required(),
    scope_id: idPattern.required(),
  }),
};

const removePermissionParam = {
  params: Joi.object({
    id: idPattern.required(),
    permissionId: idPattern.required(),
  }),
};

module.exports = {
  listUsersSchema,
  idParam,
  createUserSchema,
  updateUserSchema,
  assignRoleSchema,
  assignDepartmentSchema,
  assignPermissionSchema,
  removePermissionParam,
};
