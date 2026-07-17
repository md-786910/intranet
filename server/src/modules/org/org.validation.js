const Joi = require('joi');

const idPattern = Joi.number().integer().positive();
const scopeTypePattern = Joi.string().valid(
  'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
  'GROUP', 'COMPANY', 'ADMIN_UNIT',
);
const nodeTypePattern = Joi.string().valid(
  'COMPANY', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT', 'ADMIN_UNIT',
);

const idParam = {
  params: Joi.object({
    id: idPattern.required(),
  }),
};

// ── Generic node schemas ──
const createNodeSchema = {
  body: Joi.object({
    parent_id: idPattern.required(),
    node_type: nodeTypePattern.required(),
    kind: Joi.string().valid('OPERATIONAL', 'ADMINISTRATIVE').optional(),
    name: Joi.string().trim().min(1).max(255).required(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
    sort_order: Joi.number().integer().min(0).default(0),
  }),
};

const updateNodeSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    name: Joi.string().trim().min(1).max(255).optional(),
    code: Joi.string().trim().max(64).optional().allow('', null),
    status: Joi.string().valid('ACTIVE', 'INACTIVE', 'ARCHIVED').optional(),
    sort_order: Joi.number().integer().min(0).optional(),
    address: Joi.string().trim().max(1000).optional().allow('', null),
    city: Joi.string().trim().max(128).optional().allow('', null),
    country: Joi.string().trim().max(64).optional().allow('', null),
    timezone: Joi.string().trim().max(64).optional().allow('', null),
  }),
};

const addMemberSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    user_id: idPattern.required(),
    is_primary: Joi.boolean().optional(),
  }),
};

const memberParam = {
  params: Joi.object({
    id: idPattern.required(),
    userId: idPattern.required(),
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
  createNodeSchema,
  updateNodeSchema,
  addMemberSchema,
  memberParam,
  createOfficeLocationSchema,
  updateOfficeLocationSchema,
  createVerticalSchema,
  updateVerticalSchema,
  createDepartmentSchema,
  updateDepartmentSchema,
};
