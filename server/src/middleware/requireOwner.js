const ApiError = require('../utils/ApiError');
const logger = require('../config/logger');

/**
 * Allows the request to proceed only if the authenticated user holds the
 * system OWNER role at any scope. Used for surface-level admin operations
 * (e.g. category CRUD) where non-Owners shouldn't even see the controls.
 */
const requireOwner = async (req, res, next) => {
  try {
    if (!req.user || !req.user.user_id) {
      return next(ApiError.unauthorized());
    }

    const { UserRoleAssignment, Role } = require('../database/models');
    const { Op } = require('sequelize');

    const owns = await UserRoleAssignment.count({
      where: {
        user_id: req.user.user_id,
        [Op.and]: [
          { [Op.or]: [{ starts_at: null }, { starts_at: { [Op.lte]: new Date() } }] },
          { [Op.or]: [{ ends_at: null }, { ends_at: { [Op.gt]: new Date() } }] },
        ],
      },
      include: [{ model: Role, as: 'role', where: { code: 'OWNER' }, required: true }],
    });

    if (owns === 0) {
      logger.warn(`requireOwner: denied user=${req.user.user_id} on ${req.method} ${req.originalUrl}`);
      return next(ApiError.forbidden('Owner privileges required'));
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = requireOwner;
