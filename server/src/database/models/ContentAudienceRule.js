module.exports = (sequelize, DataTypes) => {
  const ContentAudienceRule = sequelize.define('ContentAudienceRule', {
    audience_rule_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entity_type: {
      type: DataTypes.ENUM('NEWS', 'DOCUMENT', 'PUSH', 'ANNOUNCEMENT'),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    target_scope_type: {
      type: DataTypes.ENUM(
        'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
        'GROUP', 'COMPANY', 'ADMIN_UNIT',
      ),
      allowNull: false,
    },
    target_scope_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'content_audience_rule',
  });

  ContentAudienceRule.associate = (models) => {
    // Polymorphic scope — use scope.service.js to resolve target_scope_type + target_scope_id
  };

  return ContentAudienceRule;
};
