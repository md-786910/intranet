const logger = require('../config/logger');

/**
 * Middleware factory that derives the request scope from an existing entity
 * (NewsItem / DocumentItem) rather than trusting the body. Reads
 * `owning_scope_type`/`owning_scope_id` off the entity and stuffs them into
 * `req.body.scope_type/id` so the downstream `authorize` middleware checks
 * permissions at the entity's actual scope.
 *
 * Used on per-id action routes (publish / unpublish / notify / archive /
 * audience update) where the client posts an empty body. Without this, the
 * default `authorize` fallback to ORGANISATION rejects DEPARTMENT-scoped
 * editors even when their role legitimately covers the entity.
 */
const loadEntityScope = (modelName, entityIdParam = 'id') => async (req, res, next) => {
  try {
    const models = require('../database/models');
    const model = models[modelName];
    if (!model) {
      logger.warn(`loadEntityScope: unknown model ${modelName}`);
      return next();
    }

    const id = req.params[entityIdParam];
    if (!id) return next();

    const entity = await model.findByPk(id, {
      attributes: ['owning_scope_type', 'owning_scope_id'],
    });

    if (entity && entity.owning_scope_type && entity.owning_scope_id) {
      req.body = req.body || {};
      if (!req.body.scope_type && !req.body.owning_scope_type) {
        req.body.scope_type = entity.owning_scope_type;
      }
      if (!req.body.scope_id && !req.body.owning_scope_id) {
        req.body.scope_id = entity.owning_scope_id;
      }
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = loadEntityScope;
