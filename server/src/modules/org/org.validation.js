const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT');

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createOfficeLocationSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).default(0),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const updateOfficeLocationSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const createVerticalSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    office_location_id: idPattern.required(),
    sort_order: Joi.number().integer().min(0).default(0),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const updateVerticalSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const createDepartmentSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    vertical_id: idPattern.required(),
    sort_order: Joi.number().integer().min(0).default(0),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

const updateDepartmentSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
    scope_type: scopeTypePattern.optional(),
    scope_id: idPattern.optional(),
  }),
};

module.exports = {
  idParam,
  createOfficeLocationSchema,
  updateOfficeLocationSchema,
  createVerticalSchema,
  updateVerticalSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
};
