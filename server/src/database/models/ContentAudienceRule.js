module.exports = (sequelize, DataTypes) => {
  const ContentAudienceRule = sequelize.define('ContentAudienceRule', {
    audience_rule_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    entity_type: {
      type: DataTypes.ENUM('NEWS', 'DOCUMENT', 'PUSH'),
      allowNull: false,
    },
    entity_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    target_org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  }, {
    tableName: 'content_audience_rule',
  });

  ContentAudienceRule.associate = (models) => {
    ContentAudienceRule.belongsTo(models.OrgUnit, {
      foreignKey: 'target_org_unit_id',
      as: 'targetOrgUnit',
    });
  };

  return ContentAudienceRule;
};
