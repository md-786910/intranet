const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const listEmployeesSchema = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    search: Joi.string().trim().max(255).optional().allow(''),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED', 'INVITED').optional(),
    office_location_id: idPattern.optional(),
    vertical_id: idPattern.optional(),
    department_id: idPattern.optional(),
    max_role_rank: Joi.number().integer().min(1).optional(),
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
    last_name: Joi.string().trim().min(1).max(100).required(),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    job_title: Joi.string().trim().max(255).optional().allow('', null),
    employee_id: Joi.string().trim().max(50).optional().allow('', null),
    role_category_id: idPattern.required()
      .messages({ 'any.required': 'Role category is required' }),
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
    last_name: Joi.string().trim().min(1).max(100).optional(),
    phone: Joi.string().trim().max(20).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'LOCKED').optional(),
    job_title: Joi.string().trim().max(255).optional().allow('', null),
    employee_id: Joi.string().trim().max(50).optional().allow('', null),
    role_category_id: idPattern.optional().allow(null),
    reports_to_user_id: idPattern.optional().allow(null),
    department_ids: Joi.array().items(idPattern).min(1).optional(),
    primary_department_id: idPattern.optional(),
    chat_blocked_user_ids: Joi.array().items(idPattern).optional(),
    date_of_joining: Joi.date().iso().optional().allow(null),
    location: Joi.string().trim().max(255).optional().allow('', null),
    bio: Joi.string().trim().max(2000).optional().allow('', null),
  }),
};

module.exports = {
  listEmployeesSchema,
  idParam,
  createEmployeeSchema,
  updateEmployeeSchema,
};
