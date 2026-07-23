module.exports = (sequelize, DataTypes) => {
  const PushCampaign = sequelize.define('PushCampaign', {
    push_campaign_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('DRAFT', 'SCHEDULED', 'SENT', 'CANCELLED'),
      defaultValue: 'DRAFT',
      allowNull: false,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    owning_scope_type: {
      type: DataTypes.ENUM(
        'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
        'GROUP', 'COMPANY', 'ADMIN_UNIT',
      ),
      allowNull: false,
    },
    owning_scope_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scheduled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    cancelled_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    recipient_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'push_campaign',
    defaultScope: {
      where: { deleted_at: null },
    },
    scopes: {
      withDeleted: {},
    },
  });

  PushCampaign.associate = (models) => {
    PushCampaign.belongsTo(models.UserAccount, {
      foreignKey: 'created_by',
      as: 'creator',
    });
    // Polymorphic scope — use scope.service.js to resolve owning_scope_type + owning_scope_id
    PushCampaign.hasMany(models.ContentAudienceRule, {
      foreignKey: 'entity_id',
      as: 'audienceRules',
      constraints: false,
      scope: { entity_type: 'PUSH' },
    });
  };

  return PushCampaign;
};
