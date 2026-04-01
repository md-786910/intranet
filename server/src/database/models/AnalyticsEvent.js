module.exports = (sequelize, DataTypes) => {
  const AnalyticsEvent = sequelize.define('AnalyticsEvent', {
    analytics_event_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    event_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    target_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    target_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    org_unit_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
  }, {
    tableName: 'analytics_event',
    timestamps: true,
    updatedAt: false,
    createdAt: 'created_at',
  });

  AnalyticsEvent.associate = (models) => {
    AnalyticsEvent.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    AnalyticsEvent.belongsTo(models.OrgUnit, {
      foreignKey: 'org_unit_id',
      as: 'orgUnit',
    });
  };

  return AnalyticsEvent;
};
