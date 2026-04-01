const ApiError = require('../utils/ApiError');

/**
 * Joi validation middleware factory.
 * @param {Object} schema - Joi schema object with optional keys: body, query, params
 */
const validate = (schema) => (req, res, next) => {
  const sources = ['body', 'query', 'params'];
  const errors = [];

  sources.forEach((source) => {
    if (schema[source]) {
      const { error, value } = schema[source].validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });

      if (error) {
        error.details.forEach((detail) => {
          errors.push({
            field: detail.path.join('.'),
            message: detail.message.replace(/"/g, ''),
            source,
          });
        });
      } else {
        // Replace with sanitized/coerced values
        req[source] = value;
      }
    }
  });

  if (errors.length > 0) {
    return next(ApiError.badRequest('Validation failed', errors));
  }

  next();
};

module.exports = validate;
