const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const dashboardSchema = {
  query: Joi.object({
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
  }),
};

const analyticsQuerySchema = {
  query: Joi.object({
    scope_type: Joi.string().valid('ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT').optional(),
    scope_id: idPattern.optional(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    granularity: Joi.string().valid('day', 'week', 'month').default('week'),
  }),
};

const contentWorkspaceSchema = {
  query: Joi.object({
    period: Joi.string().valid('7d', '30d', 'week').default('7d'),
    type: Joi.string().valid('all', 'news', 'documents', 'announcements').default('all'),
  }),
};

module.exports = {
  dashboardSchema,
  analyticsQuerySchema,
  contentWorkspaceSchema,
};
