const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const dashboardSchema = {
  query: Joi.object({
    org_unit_id: idPattern.required(),
  }),
};

const analyticsQuerySchema = {
  query: Joi.object({
    org_unit_id: idPattern.required(),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().optional(),
    granularity: Joi.string().valid('day', 'week', 'month').default('week'),
  }),
};

module.exports = {
  dashboardSchema,
  analyticsQuerySchema,
};
