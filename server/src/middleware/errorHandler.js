const logger = require('../config/logger');
const ApiError = require('../utils/ApiError');

/**
 * Global error handler.
 * Must be the LAST middleware registered in app.js.
 *
 * Security: never expose stack traces or internal details in production.
 */
// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle Sequelize validation errors
  if (err.name === 'SequelizeValidationError') {
    const errors = err.errors.map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Validation failed', errors);
  }

  // Handle Sequelize unique constraint errors
  if (err.name === 'SequelizeUniqueConstraintError') {
    const fields = err.errors.map((e) => e.path).join(', ');
    error = ApiError.conflict(`Duplicate value for: ${fields}`);
  }

  // Handle Sequelize foreign key constraint errors
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    error = ApiError.badRequest('Referenced resource does not exist');
  }

  // Handle JWT errors
  if (err.name === 'TokenExpiredError' || err.name === 'JsonWebTokenError') {
    error = ApiError.unauthorized('Authentication required');
  }

  // Handle JSON parse errors
  if (err.type === 'entity.parse.failed') {
    error = ApiError.badRequest('Invalid JSON in request body');
  }

  // Handle payload too large
  if (err.type === 'entity.too.large') {
    error = ApiError.badRequest('Request body too large');
  }

  // Handle multer upload errors so the admin sees the real reason
  // ("File size exceeds 50 MB limit") instead of a generic 500.
  if (err.name === 'MulterError') {
    const limitBytes = Number(process.env.MEDIA_UPLOAD_MAX_BYTES) || 50 * 1024 * 1024;
    const limitMb = Math.round(limitBytes / (1024 * 1024));
    const messageByCode = {
      LIMIT_FILE_SIZE: `File size exceeds ${limitMb} MB limit`,
      LIMIT_FILE_COUNT: 'Too many files in this upload',
      LIMIT_UNEXPECTED_FILE: `Unexpected upload field: ${err.field || 'unknown'}`,
      LIMIT_PART_COUNT: 'Too many parts in this upload',
    };
    error = ApiError.badRequest(messageByCode[err.code] || `Upload failed: ${err.message}`);
  }

  const statusCode = error.statusCode || 500;
  // Treat plain errors that carry a statusCode (e.g. wrapped Graph errors) as operational
  // so their message is shown to the caller rather than "Internal server error".
  const isOperational = error.isOperational !== undefined
    ? error.isOperational
    : (error.statusCode !== undefined && error.statusCode < 500);

  // Log the error
  if (statusCode >= 500 || !isOperational) {
    logger.error(`[${req.requestId || 'no-id'}] ${err.message}`, {
      stack: err.stack,
      url: req.originalUrl,
      method: req.method,
      ip: req.ip,
    });
  } else {
    logger.warn(`[${req.requestId || 'no-id'}] ${statusCode} ${error.message}`);
  }

  // Build response
  const response = {
    status: statusCode >= 500 ? 'error' : 'fail',
    message: isOperational ? error.message : 'Internal server error',
  };

  if (error.errors && error.errors.length > 0) {
    response.errors = error.errors;
  }

  // Include stack trace in development only
  if (process.env.NODE_ENV === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
