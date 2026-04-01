module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    vertical_id: {
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
    tableName: 'department',
    defaultScope: { where: { deleted_at: null } },
    scopes: { withDeleted: {} },
  });

  Department.associate = (models) => {
    Department.belongsTo(models.Vertical, {
      foreignKey: 'vertical_id',
      as: 'vertical',
    });
    Department.hasMany(models.DepartmentMembership, {
      foreignKey: 'department_id',
      as: 'memberships',
    });
  };

  return Department;
};
