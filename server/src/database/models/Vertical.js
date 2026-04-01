module.exports = (sequelize, DataTypes) => {
  const Vertical = sequelize.define('Vertical', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    office_location_id: {
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
    sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
    deleted_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'vertical',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  Vertical.associate = (models) => {
    Vertical.belongsTo(models.OfficeLocation, {
      foreignKey: 'office_location_id',
      as: 'officeLocation',
    });
    Vertical.hasMany(models.Department, {
      foreignKey: 'vertical_id',
      as: 'departments',
    });
  };

  return Vertical;
};
