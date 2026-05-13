const catchAsync = require('../../utils/catchAsync');
const searchService = require('./search.service');

// Auth-only — every employee can search. Visibility is enforced inside the
// service via audienceService.matchesAudience for news/documents; contacts
// are filtered to active users only and the projection excludes PII.
const search = catchAsync(async (req, res) => {
  const result = await searchService.search({
    userId: req.user.user_id,
    q: req.query.q,
    type: req.query.type,
    categoryId: req.query.category_id,
    limit: req.query.limit,
  });
  res.status(200).json({ status: 'success', data: result });
});

module.exports = { search };
