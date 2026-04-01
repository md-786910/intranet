module.exports = (sequelize, DataTypes) => {
  const ModuleAction = sequelize.define('ModuleAction', {
    module_action_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    module_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: { model: 'module', key: 'module_id' },
    },
    action_code: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  }, {
    tableName: 'module_action',
  });

  ModuleAction.associate = (models) => {
    ModuleAction.belongsTo(models.Module, {
      foreignKey: 'module_id',
      as: 'module',
    });
    ModuleAction.hasMany(models.RolePermission, {
      foreignKey: 'module_action_id',
      as: 'rolePermissions',
    });
  };

  return ModuleAction;
};
