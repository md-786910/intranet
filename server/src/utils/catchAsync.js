/**
 * Wraps an async route handler to catch rejected promises
 * and forward errors to Express error handler via next().
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;
