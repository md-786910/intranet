module.exports = (sequelize, DataTypes) => {
  const RoleCategory = sequelize.define('RoleCategory', {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    tenant_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: { notEmpty: true },
    },
    rank: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
  }, {
    tableName: 'role_category',
  });

  RoleCategory.associate = (models) => {
    RoleCategory.hasMany(models.PersonProfile, {
      foreignKey: 'role_category_id',
      as: 'profiles',
    });
  };

  return RoleCategory;
};
