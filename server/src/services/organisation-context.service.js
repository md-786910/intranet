const ApiError = require('../utils/ApiError');

let cachedOrganisation = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

async function fetchPrimaryOrganisation() {
  const { Organisation } = require('../database/models');

  const organisation = await Organisation.findOne({
    where: { deleted_at: null, status: 'ACTIVE' },
    order: [['sort_order', 'ASC'], ['id', 'ASC']],
  });

  if (!organisation) {
    throw ApiError.notFound('No active organisation configured');
  }

  return organisation;
}

const organisationContextService = {
  async getCurrentOrganisation() {
    if (cachedOrganisation && cacheExpiresAt > Date.now()) {
      return cachedOrganisation;
    }

    cachedOrganisation = await fetchPrimaryOrganisation();
    cacheExpiresAt = Date.now() + CACHE_TTL_MS;
    return cachedOrganisation;
  },

  async getCurrentOrganisationId() {
    const organisation = await this.getCurrentOrganisation();
    return organisation.id;
  },

  invalidateCache() {
    cachedOrganisation = null;
    cacheExpiresAt = 0;
  },
};

module.exports = organisationContextService;
