module.exports = (sequelize, DataTypes) => {
  const Organisation = sequelize.define('Organisation', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      validate: { notEmpty: true },
    },
    code: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED'),
      defaultValue: 'ACTIVE',
      allowNull: false,
    },
    address: { type: DataTypes.TEXT, allowNull: true },
    city: { type: DataTypes.STRING(128), allowNull: true },
    country: { type: DataTypes.STRING(64), allowNull: true },
    timezone: { type: DataTypes.STRING(64), allowNull: true },
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'organisation',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  Organisation.associate = (models) => {
    Organisation.hasMany(models.OfficeLocation, {
      foreignKey: 'organisation_id',
      as: 'officeLocations',
    });
  };

  return Organisation;
};
