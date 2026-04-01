const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

const createOfficeLocationSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    parent_org_unit_id: idPattern.required()
      .messages({ 'any.required': 'Parent organisation ID is required' }),
    org_unit_id: idPattern.required()
      .messages({ 'any.required': 'Scope org_unit_id is required for authorization' }),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateOfficeLocationSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    org_unit_id: idPattern.required(),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
  }),
};

const createVerticalSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    parent_org_unit_id: idPattern.required()
      .messages({ 'any.required': 'Parent office location ID is required' }),
    org_unit_id: idPattern.required(),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateVerticalSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    org_unit_id: idPattern.required(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
  }),
};

const createDepartmentSchema = {
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional(),
    parent_org_unit_id: idPattern.required()
      .messages({ 'any.required': 'Parent vertical ID is required' }),
    org_unit_id: idPattern.required(),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateDepartmentSchema = {
  params: Joi.object({
    id: idPattern.required(),
  }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    org_unit_id: idPattern.required(),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
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
