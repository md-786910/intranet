module.exports = (sequelize, DataTypes) => {
  const UserPermission = sequelize.define('UserPermission', {
    user_permission_id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    module_action_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    effect: {
      type: DataTypes.ENUM('ALLOW', 'DENY'),
      defaultValue: 'ALLOW',
      allowNull: false,
    },
    scope_type: {
      type: DataTypes.ENUM(
        'ORGANISATION', 'OFFICE_LOCATION', 'VERTICAL', 'DEPARTMENT',
        'GROUP', 'COMPANY', 'ADMIN_UNIT',
      ),
      allowNull: false,
    },
    scope_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    assigned_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  }, {
    tableName: 'user_permission',
  });

  UserPermission.associate = (models) => {
    UserPermission.belongsTo(models.UserAccount, {
      foreignKey: 'user_id',
      as: 'user',
    });
    UserPermission.belongsTo(models.ModuleAction, {
      foreignKey: 'module_action_id',
      as: 'moduleAction',
    });
  };

  return UserPermission;
};
