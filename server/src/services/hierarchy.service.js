const ApiError = require('../utils/ApiError');

const hierarchyService = {
  /**
   * Build full tree structure for admin UI display.
   * Returns the organisation with nested office locations, verticals, and departments.
   */
  async getFullTree(organisationId) {
    const { Organisation, OfficeLocation, Vertical, Department } = require('../database/models');

    const org = await Organisation.findByPk(organisationId, {
      include: [{
        model: OfficeLocation,
        as: 'officeLocations',
        where: { deleted_at: null },
        required: false,
        include: [{
          model: Vertical,
          as: 'verticals',
          where: { deleted_at: null },
          required: false,
          include: [{
            model: Department,
            as: 'departments',
            where: { deleted_at: null },
            required: false,
          }],
        }],
      }],
    });

    if (!org) throw ApiError.notFound('Organisation not found');
    return org;
  },

  /**
   * Create an office location under an organisation.
   */
  async createOfficeLocation(data, transaction) {
    const { Organisation, OfficeLocation } = require('../database/models');

    const org = await Organisation.findByPk(data.organisation_id, { transaction });
    if (!org) throw ApiError.notFound('Organisation not found');

    return OfficeLocation.create(data, { transaction });
  },

  /**
   * Create a vertical under an office location.
   */
  async createVertical(data, transaction) {
    const { OfficeLocation, Vertical } = require('../database/models');

    const office = await OfficeLocation.findByPk(data.office_location_id, { transaction });
    if (!office) throw ApiError.notFound('Office location not found');

    return Vertical.create(data, { transaction });
  },

  /**
   * Create a department under a vertical.
   */
  async createDepartment(data, transaction) {
    const { Vertical, Department } = require('../database/models');

    const vertical = await Vertical.findByPk(data.vertical_id, { transaction });
    if (!vertical) throw ApiError.notFound('Vertical not found');

    return Department.create(data, { transaction });
  },
};

module.exports = hierarchyService;
