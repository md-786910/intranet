/**
 * Build pagination metadata from Sequelize findAndCountAll result.
 * @param {number} page - Current page (1-based)
 * @param {number} limit - Items per page
 * @param {number} total - Total matching records
 * @returns {Object} Pagination metadata
 */
const buildPagination = (page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
};

/**
 * Parse pagination query params with defaults and safety bounds.
 * @param {Object} query - Express req.query
 * @returns {{ page: number, limit: number, offset: number }}
 */
const parsePagination = (query) => {
  let page = parseInt(query.page, 10) || 1;
  let limit = parseInt(query.limit, 10) || 20;

  // Safety bounds
  if (page < 1) page = 1;
  if (limit < 1) limit = 1;
  if (limit > 100) limit = 100;

  const offset = (page - 1) * limit;
  return { page, limit, offset };
};

module.exports = { buildPagination, parsePagination };
