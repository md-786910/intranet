module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    audit_log_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    resource_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    resource_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    details: {
      type: DataTypes.JSONB,
      allowNull: true,
    },
    ip_address: {
      type: DataTypes.STRING(45),
      allowNull: true,
    },
    user_agent: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    request_id: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    result: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
  }, {
    tableName: 'audit_log',
    timestamps: true,
    updatedAt: false, // Append-only: no updates
    createdAt: 'created_at',
  });

  AuditLog.associate = (models) => {
    AuditLog.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
  };

  return AuditLog;
};
