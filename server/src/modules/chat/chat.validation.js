const Joi = require('joi');

const createConversationSchema = {
  body: Joi.object({
    userId: Joi.number().integer().positive().required(),
  }),
};

const getMessagesSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),
};

const markAsReadSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required(),
  }),
};

const getContactsSchema = {
  query: Joi.object({
    search: Joi.string().trim().max(100).optional().allow(''),
    limit: Joi.number().integer().min(1).max(100).default(50),
  }),
};

module.exports = {
  createConversationSchema,
  getMessagesSchema,
  markAsReadSchema,
  getContactsSchema,
};
