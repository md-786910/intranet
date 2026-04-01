module.exports = (sequelize, DataTypes) => {
  const RolePermission = sequelize.define('RolePermission', {
    role_permission_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'role', key: 'role_id' },
    },
    module_action_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'module_action', key: 'module_action_id' },
    },
    effect: {
      type: DataTypes.ENUM('ALLOW', 'DENY'),
      defaultValue: 'ALLOW',
      allowNull: false,
    },
  }, {
    tableName: 'role_permission',
  });

  RolePermission.associate = (models) => {
    RolePermission.belongsTo(models.Role, {
      foreignKey: 'role_id',
    });
    RolePermission.belongsTo(models.ModuleAction, {
      foreignKey: 'module_action_id',
      as: 'moduleAction',
    });
  };

  return RolePermission;
};
