const Joi = require('joi');

const idPattern = Joi.number().integer().positive();

const idParam = {
  params: Joi.object({ id: idPattern.required() }),
};

const newsAndCommentParams = {
  params: Joi.object({
    id: idPattern.required(),
    commentId: idPattern.required(),
  }),
};

const listCommentsSchema = {
  params: Joi.object({ id: idPattern.required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    include_deleted: Joi.boolean().default(false),
  }),
};

const createCommentSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    body: Joi.string().trim().min(1).max(2000).required(),
  }),
};

const editCommentSchema = {
  params: Joi.object({
    id: idPattern.required(),
    commentId: idPattern.required(),
  }),
  body: Joi.object({
    body: Joi.string().trim().min(1).max(2000).required(),
  }),
};

const shareSchema = {
  params: Joi.object({ id: idPattern.required() }),
  body: Joi.object({
    channel: Joi.string().valid('LINK_COPY', 'EMAIL').required(),
  }),
};

const tokenParam = {
  params: Joi.object({
    token: Joi.string().min(8).max(128).required(),
  }),
};

const adminListSchema = {
  params: Joi.object({ id: idPattern.required() }),
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    include_deleted: Joi.boolean().default(true),
  }),
};

module.exports = {
  idParam,
  newsAndCommentParams,
  listCommentsSchema,
  createCommentSchema,
  editCommentSchema,
  shareSchema,
  tokenParam,
  adminListSchema,
};
