module.exports = (sequelize, DataTypes) => {
  const OfficeLocation = sequelize.define('OfficeLocation', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    organisation_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
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
    tableName: 'office_location',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  OfficeLocation.associate = (models) => {
    OfficeLocation.belongsTo(models.Organisation, {
      foreignKey: 'organisation_id',
      as: 'organisation',
    });
    OfficeLocation.hasMany(models.Vertical, {
      foreignKey: 'office_location_id',
      as: 'verticals',
    });
  };

  return OfficeLocation;
};
