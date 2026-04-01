const { QueryTypes } = require('sequelize');
const logger = require('../config/logger');

const SCOPE_HIERARCHY = ['ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT'];

const scopeService = {
  /**
   * Resolve the full ancestor chain for a given scope.
   * Returns { organisation_id, office_location_id, vertical_id, department_id }
   * with only the levels at or above the given scope populated.
   */
  async resolveAncestors(scopeType, scopeId) {
    const { sequelize } = require('../database/models');

    switch (scopeType) {
      case 'ORGANISATION':
        return { organisation_id: scopeId, office_location_id: null, vertical_id: null, department_id: null };

      case 'OFFICE_LOCATION': {
        const [row] = await sequelize.query(
          `SELECT organisation_id FROM office_location WHERE id = :id`,
          { replacements: { id: scopeId }, type: QueryTypes.SELECT }
        );
        if (!row) return null;
        return { organisation_id: row.organisation_id, office_location_id: scopeId, vertical_id: null, department_id: null };
      }

      case 'VERTICAL': {
        const [row] = await sequelize.query(
          `SELECT v.office_location_id, ol.organisation_id
           FROM vertical v
           JOIN office_location ol ON ol.id = v.office_location_id
           WHERE v.id = :id`,
          { replacements: { id: scopeId }, type: QueryTypes.SELECT }
        );
        if (!row) return null;
        return { organisation_id: row.organisation_id, office_location_id: row.office_location_id, vertical_id: scopeId, department_id: null };
      }

      case 'DEPARTMENT': {
        const [row] = await sequelize.query(
          `SELECT d.vertical_id, v.office_location_id, ol.organisation_id
           FROM department d
           JOIN vertical v ON v.id = d.vertical_id
           JOIN office_location ol ON ol.id = v.office_location_id
           WHERE d.id = :id`,
          { replacements: { id: scopeId }, type: QueryTypes.SELECT }
        );
        if (!row) return null;
        return { organisation_id: row.organisation_id, office_location_id: row.office_location_id, vertical_id: row.vertical_id, department_id: scopeId };
      }

      default:
        return null;
    }
  },

  /**
   * Check if parentScope is an ancestor of (or equal to) childScope.
   * A role assigned at OFFICE_LOCATION level covers all VERTICALs and DEPARTMENTs under it.
   */
  async isAncestorOf(parentType, parentId, childType, childId) {
    // Same scope — always true
    if (parentType === childType && parentId === childId) return true;

    // Parent must be higher in hierarchy
    const parentLevel = SCOPE_HIERARCHY.indexOf(parentType);
    const childLevel = SCOPE_HIERARCHY.indexOf(childType);
    if (parentLevel < 0 || childLevel < 0 || parentLevel >= childLevel) return false;

    // Resolve child's ancestors and check if parent is in the chain
    const ancestors = await this.resolveAncestors(childType, childId);
    if (!ancestors) return false;

    const columnMap = {
      ORGANISATION: 'organisation_id',
      OFFICE_LOCATION: 'office_location_id',
      VERTICAL: 'vertical_id',
      DEPARTMENT: 'department_id',
    };

    return ancestors[columnMap[parentType]] === parentId;
  },

  /**
   * Get the scope name for display purposes.
   */
  async getScopeName(scopeType, scopeId) {
    const { sequelize } = require('../database/models');
    const tableMap = {
      ORGANISATION: 'organisation',
      OFFICE_LOCATION: 'office_location',
      VERTICAL: 'vertical',
      DEPARTMENT: 'department',
    };
    const table = tableMap[scopeType];
    if (!table) return null;

    const [row] = await sequelize.query(
      `SELECT name FROM ${table} WHERE id = :id`,
      { replacements: { id: scopeId }, type: QueryTypes.SELECT }
    );
    return row ? row.name : null;
  },
};

module.exports = scopeService;
