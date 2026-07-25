const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listEmployeesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED', 'INVITED').optional(),
    node_id: idPattern.optional(),
    include_subtree: Joi.boolean().default(true),
    // Legacy aliases — treated as org_node ids
    office_location_id: idPattern.optional(),
    vertical_id: idPattern.optional(),
    department_id: idPattern.optional(),
  }),
};

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createEmployeeSchema = {
  body: Joi.object({
    email: Joi.string().email().required().lowercase().trim(),
    first_name: Joi.string().trim().min(1).max(100).required(),
    last_name: Joi.string().trim().max(100).optional().allow('', null),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    job_title: Joi.string().trim().max(255).optional().allow('', null),
    employee_id: Joi.string().trim().max(50).optional().allow('', null),
    role_category_id: idPattern.optional().allow(null),
    reports_to_user_id: idPattern.optional().allow(null),
    department_ids: Joi.array().items(idPattern).min(1).required()
      .messages({ 'array.min': 'At least one department is required' }),
    primary_department_id: idPattern.optional(),
    chat_blocked_user_ids: Joi.array().items(idPattern).optional(),
  }),
};

const updateEmployeeSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    first_name: Joi.string().trim().min(1).max(100).optional(),
    last_name: Joi.string().trim().max(100).optional().allow('', null),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED').optional(),
    job_title: Joi.string().trim().max(255).optional().allow('', null),
    employee_id: Joi.string().trim().max(50).optional().allow('', null),
    role_category_id: idPattern.optional().allow(null),
    reports_to_user_id: idPattern.optional().allow(null),
    department_ids: Joi.array().items(idPattern).min(1).optional(),
    primary_department_id: idPattern.optional(),
    chat_blocked_user_ids: Joi.array().items(idPattern).optional(),
  }),
};

module.exports = {
  listEmployeesSchema,
  idParam,
  createEmployeeSchema,
  updateEmployeeSchema,
};
